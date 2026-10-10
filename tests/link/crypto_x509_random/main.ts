// `nish/crypto/x509-random`: keys and serials drawn from the kernel, and the
// certificates minted with them.
//
// Nothing drawn can be pinned, so each check is a property: a drawn key is a
// P-256 key, two draws differ, a drawn serial is twenty octets whose first is
// 0x40 to 0x7f, and a certificate minted with a drawn key and serial parses,
// carries that key and that serial, and verifies under itself. Two mints with
// one key differ in their serial, and so in their DER.
import { Secret, wipe } from "nish:secret"
import { p256PublicKey } from "nish/crypto/p256"
import { X509_MAX_SERIAL, X509Certificate, x509ParseCertificate, x509VerifySignature } from "nish/crypto/x509"
import { x509DrawP256Key, x509DrawSerial, x509MintSelfSignedDrawn } from "nish/crypto/x509-random"
import { Suite } from "nish/testing"

/** 2026-01-01T00:00:00Z, in milliseconds. */
const NOT_BEFORE: i64 = 1767225600000

/** Whether `a` and `b` hold the same bytes. */
const sameBytes = (a: u8[] | null, b: u8[] | null): boolean => {
  if (a === null || b === null) {
    return a === null && b === null
  }
  if (a.length !== b.length) {
    return false
  }
  for (let i: i32 = 0; i < toI32(a.length); i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

/** Whether `serial` is what `x509DrawSerial` promises: twenty octets, the first 0x40 to 0x7f. */
const drawnShape = (serial: u8[]): boolean =>
  toI32(serial.length) === X509_MAX_SERIAL && (toI32(serial[0]) & 0xc0) === 0x40

/** Whether `der` parses, verifies under itself and carries `pub` and a drawn serial. */
const mintedSound = (der: u8[] | null, pub: u8[] | null): boolean => {
  if (der === null || pub === null) {
    return false
  }
  const cert: X509Certificate | null = x509ParseCertificate(der)
  if (cert === null) {
    return false
  }
  return x509VerifySignature(cert, cert) && sameBytes(cert.publicKey, pub) && drawnShape(cert.serial)
}

/** The serial `der` carries, or `null` when it does not parse. */
const serialOf = (der: u8[] | null): u8[] | null => {
  if (der === null) {
    return null
  }
  const cert: X509Certificate | null = x509ParseCertificate(der)
  return cert === null ? null : cert.serial
}

const keySuite = (): i32 => {
  const t = new Suite("x509-random keys")
  const a: Secret<u8[]> = x509DrawP256Key()
  const b: Secret<u8[]> = x509DrawP256Key()
  const pubA: u8[] | null = p256PublicKey(a)
  const pubB: u8[] | null = p256PublicKey(b)
  wipe(a)
  wipe(b)
  t.ok("a drawn key is a P-256 private key", pubA !== null)
  t.ok("so is a second", pubB !== null)
  t.ok("the two differ", !sameBytes(pubA, pubB))
  return t.done()
}

const serialSuite = (): i32 => {
  const t = new Suite("x509-random serials")
  const first: u8[] = x509DrawSerial()
  let shaped: boolean = drawnShape(first)
  let distinct: boolean = true
  // 64 draws: the low six bits of the first octet are random, so a clamp that
  // forced them would show here, and two equal draws of 158 bits would not.
  let low: i32 = 0
  for (let i: i32 = 0; i < 64; i++) {
    const next: u8[] = x509DrawSerial()
    shaped = shaped && drawnShape(next)
    distinct = distinct && !sameBytes(first, next)
    low = low | (toI32(next[0]) & 0x3f)
  }
  t.ok("65 serials are twenty octets with the top bits 01", shaped)
  t.ok("none equals the first", distinct)
  t.ok("the first octet's low six bits vary", low === 0x3f)
  return t.done()
}

const mintSuite = (): i32 => {
  const t = new Suite("x509-random mint")
  const priv: Secret<u8[]> = x509DrawP256Key()
  const pub: u8[] | null = p256PublicKey(priv)
  const one: u8[] | null = x509MintSelfSignedDrawn(priv, "localhost", NOT_BEFORE, 14)
  const two: u8[] | null = x509MintSelfSignedDrawn(priv, "localhost", NOT_BEFORE, 14)
  const late: u8[] | null = x509MintSelfSignedDrawn(priv, "localhost", NOT_BEFORE, 15)
  const nameless: u8[] | null = x509MintSelfSignedDrawn(priv, "", NOT_BEFORE, 14)
  wipe(priv)
  t.ok("a mint with a drawn key and serial parses, carries both and verifies under itself", mintedSound(one, pub))
  t.ok("so does a second with the same key", mintedSound(two, pub))
  t.ok("their serials differ", !sameBytes(serialOf(one), serialOf(two)))
  t.ok("so their DER differs", !sameBytes(one, two))
  t.ok("15 days answers null, as x509MintSelfSigned does", late === null)
  t.ok("an empty common name answers null", nameless === null)

  const other: Secret<u8[]> = x509DrawP256Key()
  const otherPub: u8[] | null = p256PublicKey(other)
  const third: u8[] | null = x509MintSelfSignedDrawn(other, "localhost", NOT_BEFORE, 14)
  wipe(other)
  t.ok("a mint with another drawn key is sound", mintedSound(third, otherPub))
  t.ok("and carries a key unlike the first", !sameBytes(otherPub, pub))
  return t.done()
}

export const main = (): i32 => keySuite() + serialSuite() + mintSuite()

// The regressions of the X.509 security audit (docs/security/crypto-x509.md),
// one block per finding, and the properties the record says the parsers keep.
//
// X509-1 and X509-2: `pemToDer` decoded only the blocks with the label asked
// for, so a malformed block beside them was skipped, and a SEC1 key read
// beside a broken `PRIVATE KEY` block was accepted as the only key. X509-3:
// `x509MintSelfSigned` wrote any bytes as the UTF8String common name. X509-4:
// the `[1]`, `[2]` and `[3]` elements after the key were skipped unread, so
// `[3]` holding a NULL, or a unique identifier with 8 unused bits, parsed. The
// X509-5 block pins what the record states `x509ParseChain` and
// `x509ParseCertificate` do not check, so a change that starts checking one
// has to say so here. X509-8: a version-1 PKCS#8 key's outer `[1]` public key
// was stepped over, so arbitrary bytes there parsed.
import { Suite } from "nish/testing"
import {
  X509Certificate,
  derToPem,
  pemToDer,
  x509ParseCertificate,
  x509ParseChain,
  x509VerifySignature,
} from "nish/crypto/x509"
import { x509MintSelfSignedPlain as x509MintSelfSigned, x509ParseP256PrivateKeyPlain as x509ParseP256PrivateKey } from "../crypto_x509/plain"
import {
  A25_PRIVATE,
  CA_PEM,
  CA_PKCS8_PEM,
  CA_PRIVATE,
  CA_SEC1_PEM,
  GOLDEN_NO_EXTENSIONS,
  GOLDEN_PEM,
  LEAF_PEM,
} from "../crypto_x509/fixtures"
import { fromHex, textOf, toHex } from "../crypto_x509/hex"

// 2026-01-01T00:00:00Z.
const NOT_BEFORE: i64 = 1767225600000
// GOLDEN_NO_EXTENSIONS with its two validity times swapped: notBefore 2026-01-15, notAfter 2026-01-01.
const SWAPPED: string =
  "308201223081caa00302010202100123456789abcdef0123456789abcdef300a06082a8648ce3d04030230143112301006035504030c096c6f63616c686f7374301e170d3236303131353030303030305a170d3236303130313030303030305a30143112301006035504030c096c6f63616c686f73743059301306072a8648ce3d020106082a8648ce3d0301070342000460fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299300a06082a8648ce3d0403020347003044022041e3cdab220d60d16846a1033a3679f7b0fe54fc74492d8ba72f70817578970302206e840bdbd9eac275a7ca1ca3b39ca8a23e20a06e2d83a076f797bf5a10226506"

// The CA key as a version-1 OneAsymmetricKey (RFC 5958 §2): CA_PKCS8_PEM's DER
// with the version 1 and an outer `[1] IMPLICIT BIT STRING`, 81 42 00 then the
// 65-octet point, appended. Built by hand, since OpenSSL writes version 0.
const V1_PREFIX: string =
  "020101301306072a8648ce3d020106082a8648ce3d030107046d306b02010104201bca349ed315194d55d7b94609b0c8f186acccff93ab2a3c48dafd40b748fe0da14403420004b5e1f9062ba0e3a0ca966d3e7335d952370dfbad6f90eee8897ac6141e850a0dd864061fd213b52b46c94515f0332e2976466a0cbb2c46054d8a97c30fe33636"
const CA_POINT: string =
  "04b5e1f9062ba0e3a0ca966d3e7335d952370dfbad6f90eee8897ac6141e850a0dd864061fd213b52b46c94515f0332e2976466a0cbb2c46054d8a97c30fe33636"
// RFC 6979 A.2.5's point, which is not the CA key's.
const A25_POINT: string =
  "0460fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299"

/** What `x509ParseP256PrivateKey` reads from the v1 CA key with `outerHex` as its outer public key, or "null". */
const v1Key = (outerHex: string): string => {
  const body: u8[] = fromHex(`${V1_PREFIX}${outerHex}`)
  const der: u8[] = [0x30, 0x81, toU8(toI32(body.length))]
  for (let i: i32 = 0; i < toI32(body.length); i++) {
    der.push(body[i])
  }
  return toHex(x509ParseP256PrivateKey(derToPem(der, "PRIVATE KEY")))
}

/** The golden certificate's DER, out of OpenSSL's PEM of it. */
const golden = (): u8[] => {
  const blocks: u8[][] | null = pemToDer(GOLDEN_PEM, "CERTIFICATE")
  return blocks === null || toI32(blocks.length) !== 1 ? [] : blocks[0]
}

/**
 * The mint's certificate from before X509-9, which ended at the key
 * (`GOLDEN_NO_EXTENSIONS`), with `extra` appended to its tbsCertificate after
 * the key, and both lengths grown to match. The signature no longer covers the
 * TBS, which the parser does not look at; `extra` stays under 50 octets so
 * both lengths keep their form (`30 82 01 xx`, `30 81 xx`).
 */
const withTrailing = (extraHex: string): u8[] => {
  const g: u8[] = fromHex(GOLDEN_NO_EXTENSIONS)
  const extra: u8[] = fromHex(extraHex)
  const grow: i32 = toI32(extra.length)
  const outer: i32 = 0x122 + grow
  const out: u8[] = [0x30, 0x82, toU8(outer >> 8), toU8(outer & 0xff), 0x30, 0x81, toU8(0xca + grow)]
  for (let i: i32 = 7; i < 209 && i < toI32(g.length); i++) {
    out.push(g[i])
  }
  for (let i: i32 = 0; i < toI32(extra.length); i++) {
    out.push(extra[i])
  }
  for (let i: i32 = 209; i < toI32(g.length); i++) {
    out.push(g[i])
  }
  return out
}

/** Whether `x509ParseCertificate` reads the old golden with `extraHex` after the key. */
const readsWith = (extraHex: string): boolean => x509ParseCertificate(withTrailing(extraHex)) !== null

/** The mint with the golden's key, time and days, serial 1, under `name`. */
const mintName = (name: string): u8[] | null =>
  x509MintSelfSigned(fromHex(A25_PRIVATE), name, NOT_BEFORE, 14, fromHex("01"))

/** `hex` as a string of those bytes, which need not be UTF-8. */
const rawString = (hex: string): string => textOf(fromHex(hex))

/** Whether a mint under the name spelled by `hex` answers `null`. */
const mintRefuses = (hex: string): boolean => mintName(`a${rawString(hex)}z`) === null

/** The subject Name's DER of what the mint writes under the name spelled by `hex`, or "null". */
const mintedSubject = (hex: string): string => {
  const der: u8[] | null = mintName(rawString(hex))
  const cert: X509Certificate | null = der === null ? null : x509ParseCertificate(der)
  return cert === null ? "null" : toHex(cert.subject)
}

const pemSuite = (): i32 => {
  const t = new Suite("X509-1, X509-2: every PEM block is decoded")
  const broken: string = "-----BEGIN PRIVATE KEY-----\nAB==\n-----END PRIVATE KEY-----\n"
  t.eqStr(
    "a SEC1 key beside a malformed PRIVATE KEY block answers null",
    toHex(x509ParseP256PrivateKey(`${CA_SEC1_PEM}${broken}`)),
    "null"
  )
  t.eqStr(
    "a PKCS#8 key beside a malformed EC PRIVATE KEY block answers null",
    toHex(x509ParseP256PrivateKey(`${CA_PKCS8_PEM}-----BEGIN EC PRIVATE KEY-----\nA-AA\n-----END EC PRIVATE KEY-----\n`)),
    "null"
  )
  t.eqStr("the SEC1 key alone still reads", toHex(x509ParseP256PrivateKey(CA_SEC1_PEM)), CA_PRIVATE)
  t.ok(
    "a certificate beside a block of another label that is not base64 answers null",
    pemToDer(`${GOLDEN_PEM}-----BEGIN Y-----\nA!!A\n-----END Y-----\n`, "CERTIFICATE") === null
  )
  t.ok(
    "a certificate beside a block of another label with padding bits set answers null",
    pemToDer(`-----BEGIN Y-----\nAB==\n-----END Y-----\n${GOLDEN_PEM}`, "CERTIFICATE") === null
  )
  t.ok(
    "a BEGIN line inside another label's block answers null",
    pemToDer(`-----BEGIN Y-----\n${GOLDEN_PEM}-----END Y-----\n`, "CERTIFICATE") === null
  )
  const both: u8[][] | null = pemToDer(`${CA_SEC1_PEM}${GOLDEN_PEM}`, "CERTIFICATE")
  t.eqI32("a well-formed block of another label is still skipped", both === null ? -1 : toI32(both.length), 1)
  return t.done()
}

const nameSuite = (): i32 => {
  const t = new Suite("X509-3: the minted common name is UTF-8 without NUL")
  t.ok("an overlong NUL, C0 80, answers null", mintRefuses("c080"))
  t.ok("an overlong slash, E0 80 AF, answers null", mintRefuses("e080af"))
  t.ok("a lone continuation octet answers null", mintRefuses("80"))
  t.ok("a truncated three-octet sequence answers null", mintRefuses("e282"))
  t.ok("a truncated sequence at the very end answers null", mintName(`a${rawString("e282")}`) === null)
  t.ok("a surrogate, ED A0 80, answers null", mintRefuses("eda080"))
  t.ok("past U+10FFFF, F4 90 80 80, answers null", mintRefuses("f4908080"))
  t.ok("F5 and above answer null", mintRefuses("f5808080"))
  t.ok("FF answers null", mintRefuses("ff"))
  t.ok("a NUL answers null", mintRefuses("00"))
  t.eqStr(
    "ASCII still mints: CN=localhost",
    mintedSubject("6c6f63616c686f7374"),
    "30143112301006035504030c096c6f63616c686f7374"
  )
  t.eqStr("two octets, U+00FC, mint as written", mintedSubject("c3bc"), "300d310b300906035504030c02c3bc")
  t.eqStr("three octets, U+20AC, mint as written", mintedSubject("e282ac"), "300e310c300a06035504030c03e282ac")
  t.eqStr("U+D7FF, the last before the surrogates, mints", mintedSubject("ed9fbf"), "300e310c300a06035504030c03ed9fbf")
  t.eqStr("four octets, U+10FFFF, mint as written", mintedSubject("f48fbfbf"), "300f310d300b06035504030c04f48fbfbf")
  return t.done()
}

const trailingSuite = (): i32 => {
  const t = new Suite("X509-4: what follows the key is well formed")
  t.ok("the old golden, v3 with nothing after the key, reads", readsWith(""))
  t.ok("[3] holding a real extension reads", readsWith("a310300e300c0603551d130101ff04023000"))
  t.eqBool("[3] holding a NULL is refused", readsWith("a3020500"), false)
  t.eqBool("[3] holding an empty SEQUENCE is refused", readsWith("a3023000"), false)
  t.eqBool("[3] holding a SEQUENCE and then more is refused", readsWith("a306300205003000"), false)
  t.eqBool("two [3] elements are refused", readsWith("a30430020500a30430020500"), false)
  t.ok("[1] as an empty BIT STRING, 81 01 00, reads", readsWith("810100"))
  t.ok("[1] with four unused bits of one octet reads", readsWith("810204f0"))
  t.ok("[1], [2] and [3] in order read", readsWith("810100820100a30430020500"))
  t.eqBool("[1] with no contents at all is refused", readsWith("8100"), false)
  t.eqBool("[1] claiming 8 unused bits is refused", readsWith("810108"), false)
  t.eqBool("[1] claiming unused bits with no octet is refused", readsWith("810103"), false)
  t.eqBool("[2] claiming 8 unused bits is refused", readsWith("820208ff"), false)
  t.eqBool("[1] with an unused bit set is refused", readsWith("810204f1"), false)
  return t.done()
}

const scopeSuite = (): i32 => {
  const t = new Suite("X509-5: a parser, not a validator")
  const reversed: X509Certificate[] | null = x509ParseChain(`${CA_PEM}${LEAF_PEM}`)
  t.eqI32("a chain in the wrong order still reads", reversed === null ? -1 : toI32(reversed.length), 2)
  const unrelated: X509Certificate[] | null = x509ParseChain(`${LEAF_PEM}${GOLDEN_PEM}`)
  t.eqI32("a leaf and a certificate that did not issue it still read", unrelated === null ? -1 : toI32(unrelated.length), 2)
  if (unrelated !== null && toI32(unrelated.length) === 2) {
    t.eqBool("and the leaf does not verify under it", x509VerifySignature(unrelated[0], unrelated[1]), false)
  }
  const swapped: X509Certificate | null = x509ParseCertificate(fromHex(SWAPPED))
  t.ok("notBefore after notAfter still reads", swapped !== null && swapped.notBefore > swapped.notAfter)
  const g: X509Certificate | null = x509ParseCertificate(golden())
  t.ok("a certificate whose fourteen days are long past still reads and verifies", g !== null && x509VerifySignature(g, g))
  return t.done()
}

const outerKeySuite = (): i32 => {
  const t = new Suite("X509-8: a PKCS#8 v1 key's outer public key is its own")
  t.eqStr("v1 with its own point as the outer public key reads", v1Key(`814200${CA_POINT}`), CA_PRIVATE)
  t.eqStr("v1 with another key's point answers null", v1Key(`814200${A25_POINT}`), "null")
  t.eqStr("v1 with an empty [1], 81 00, answers null", v1Key("8100"), "null")
  t.eqStr("v1 with its own point but 8 unused bits answers null", v1Key(`814208${CA_POINT}`), "null")
  t.eqStr("v1 with its own point but 1 unused bit answers null", v1Key(`814201${CA_POINT}`), "null")
  t.eqStr("v1 with the point cut to 64 octets answers null", v1Key(`814100${CA_POINT.substring(0, 128)}`), "null")
  t.eqStr("v1 with no outer public key still reads", v1Key(""), CA_PRIVATE)
  return t.done()
}

export const main = (): i32 => pemSuite() + nameSuite() + trailingSuite() + scopeSuite() + outerKeySuite()

// A malformed certificate is a refusal, never a panic, for both the X.509
// parser and path validation: OpenSSL's leaf and intermediate from
// `crypto_pki`, cut short at every length, with an outer or inner length that
// runs past its buffer, and with a tag that is not a SEQUENCE. Each comes back
// from `x509ParseCertificate` as `null`, and a chain holding it comes back
// from `pkiVerifyServer` as PKI_ERR_MALFORMED, whichever position it holds.
// The process reaching its summary is the proof that none of them panicked.
import { Suite } from "nish/testing"
import { PKI_ERR_MALFORMED, PKI_OK, PkiTrustStore, pkiReason, pkiTrustStore, pkiVerifyServer } from "nish/crypto/pki"
import { X509Certificate, x509ParseCertificate } from "nish/crypto/x509"
import { fromHex } from "../crypto_x25519/hex"
import { INT, LEAF, NOW_MS, ROOT } from "../crypto_pki/fixtures"

const parsed = (der: u8[]): X509Certificate => {
  const c: X509Certificate | null = x509ParseCertificate(der)
  if (c === null) {
    return new X509Certificate()
  }
  return c
}

/** The first `n` bytes of `der`. */
const cut = (der: u8[], n: i32): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < n && i < toI32(der.length); i++) {
    out.push(der[i])
  }
  return out
}

/** `der` with the byte at `at` set to `v`. */
const edit = (der: u8[], at: i32, v: i32): u8[] => {
  const out: u8[] = cut(der, toI32(der.length))
  if (at >= 0 && at < toI32(out.length)) {
    out[at] = toU8(v)
  }
  return out
}

/** `der` with the two-octet long-form length at `at` set to `n`. */
const lengthAt = (der: u8[], at: i32, n: i32): u8[] => edit(edit(der, at, n >> 8), at + 1, n & 255)

/** Whether `bad` is refused by the parser, and as leaf and as intermediate. */
const refused = (s: Suite, store: PkiTrustStore, name: string, bad: u8[], leaf: u8[], int: u8[]): boolean => {
  const asLeaf: i32 = pkiVerifyServer([bad, int], "example.com", NOW_MS, store).code
  const asInt: i32 = pkiVerifyServer([leaf, bad], "example.com", NOW_MS, store).code
  if (x509ParseCertificate(bad) !== null) {
    return s.fail(name, "the parser accepted it")
  }
  if (asLeaf !== PKI_ERR_MALFORMED || asInt !== PKI_ERR_MALFORMED) {
    return s.fail(name, `as leaf ${pkiReason(asLeaf)}, as intermediate ${pkiReason(asInt)}`)
  }
  return s.pass(name)
}

/** Every cut of `der` short of its whole length; the name of the first that is not refused, or "". */
const everyCut = (store: PkiTrustStore, der: u8[], leaf: u8[], int: u8[], asLeaf: boolean): string => {
  for (let n: i32 = 0; n < toI32(der.length); n++) {
    const bad: u8[] = cut(der, n)
    const chain: u8[][] = asLeaf ? [bad, int] : [leaf, bad]
    if (
      x509ParseCertificate(bad) !== null ||
      pkiVerifyServer(chain, "example.com", NOW_MS, store).code !== PKI_ERR_MALFORMED
    ) {
      return `${n} bytes`
    }
  }
  return ""
}

export const main = (): i32 => {
  const s = new Suite("pki malformed")
  const store: PkiTrustStore = pkiTrustStore([parsed(fromHex(ROOT))])
  const leaf: u8[] = fromHex(LEAF)
  const int: u8[] = fromHex(INT)
  const ok: i32 = pkiVerifyServer([leaf, int], "example.com", NOW_MS, store).code
  if (ok === PKI_OK) {
    s.pass("the unedited chain is accepted")
  } else {
    s.fail("the unedited chain is accepted", pkiReason(ok))
  }

  const leafCut: string = everyCut(store, leaf, leaf, int, true)
  if (leafCut === "") {
    s.pass(`the leaf cut at each of ${leaf.length} lengths`)
  } else {
    s.fail("the leaf cut short", leafCut)
  }
  const intCut: string = everyCut(store, int, leaf, int, false)
  if (intCut === "") {
    s.pass(`the intermediate cut at each of ${int.length} lengths`)
  } else {
    s.fail("the intermediate cut short", intCut)
  }

  // Both certificates open `30 82 hh ll` (the certificate) and
  // `30 82 hh ll` again at offset 4 (tbsCertificate).
  for (const which of ["leaf", "intermediate"]) {
    const der: u8[] = which === "leaf" ? leaf : int
    refused(s, store, `the ${which}: its length one past its buffer`, lengthAt(der, 2, toI32(der.length) - 3), leaf, int)
    refused(s, store, `the ${which}: its length 65535`, lengthAt(der, 2, 65535), leaf, int)
    refused(s, store, `the ${which}: tbsCertificate's length past the certificate`, lengthAt(der, 6, toI32(der.length)), leaf, int)
    refused(s, store, `the ${which}: a five-octet length`, edit(der, 1, 0x85), leaf, int)
    refused(s, store, `the ${which}: an indefinite length`, edit(der, 1, 0x80), leaf, int)
    refused(s, store, `the ${which}: a SET for its SEQUENCE`, edit(der, 0, 0x31), leaf, int)
    refused(s, store, `the ${which}: an OCTET STRING for tbsCertificate`, edit(der, 4, 0x04), leaf, int)
    refused(s, store, `the ${which}: a zero tag`, edit(der, 0, 0x00), leaf, int)
    refused(s, store, `the ${which}: a high-tag-number tag`, edit(der, 0, 0x1f), leaf, int)
  }
  return s.done()
}

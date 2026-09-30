/**
 * `nish/crypto/x509` — DER, PEM and the X.509 certificates a WebTransport or
 * TLS server holds: read a P-256 private key and a certificate chain out of
 * PEM, and mint the short-lived self-signed ECDSA P-256 certificate a browser
 * pins by its SHA-256.
 *
 *     import { x509MintSelfSigned, x509CertificateHash, derToPem } from "nish/crypto/x509";
 *
 *     // Both secrets come from the kernel's CSPRNG; a predictable key or serial is the caller's bug.
 *     const priv: u8[] = new Array<u8>(32);
 *     crypto.getRandomValues(priv);          // p256PublicKey(priv) === null: draw again (odds 2^-32)
 *     const serial: u8[] = new Array<u8>(16);
 *     crypto.getRandomValues(serial);
 *     serial[0] = serial[0] & toU8(0x7f);   // positive, so it stays 16 octets
 *     const der: u8[] | null = x509MintSelfSigned(priv, "localhost", toI64(Date.now()), 14, serial);
 *     // x509CertificateHash(der) is what serverCertificateHashes names;
 *     // derToPem(der, "CERTIFICATE") is the file a TLS stack loads.
 *
 * Written for this module from ITU-T X.690 (DER), RFC 5280 (the certificate
 * profile), RFC 7468 (PEM's textual encoding), RFC 5915 and RFC 5208/5958 (the
 * SEC1 and PKCS#8 private-key structures), RFC 5480 (the P-256 key's
 * identifiers) and RFC 5758 (ecdsa-with-SHA256).
 *
 * **DER is read strictly.** X.690 §10 leaves one encoding per value, and a
 * reader that accepts a second spelling gives a certificate two identities
 * while its hash — which is what a browser pins — names only one. So a length
 * must be definite and minimal (no `0x80`, no long form below 128, no leading
 * zero length octet), an INTEGER must be minimal in two's complement, a tag
 * must fit in one octet, every element must end inside its parent, and a
 * certificate must end where its outer SEQUENCE does. Anything else answers
 * `null`, never a panic. The reader looks at what this module uses — the
 * version, serial, algorithms, names as opaque bytes, validity, the subject
 * public key and the signature — and checks the order of what follows the key
 * (`[1]`, `[2]`, `[3]`) without parsing extensions.
 *
 * **PEM is RFC 7468's strict grammar**, with standard base64 (`+` and `/`,
 * padded with `=`), not `base64url`: 64 characters a line and a shorter last
 * one, a `-----END` label equal to its `-----BEGIN`, no headers (so an
 * RFC 1421 encrypted key is refused), and canonical base64 whose unused low
 * bits are zero. Text between blocks is ignored, as RFC 7468 §5.2 allows, and
 * so are blocks with another label; a line may end in CRLF.
 *
 * **The minted certificate** is what the WebTransport specification's
 * `serverCertificateHashes` accepts (W3C WebTransport, "custom certificate
 * requirements"): X.509 v3, an ECDSA P-256 key signed with ecdsa-with-SHA256,
 * and a validity period of at most fourteen days — `notAfter - notBefore`,
 * which is what Chromium compares, so `days` is 1 to 14. Subject and issuer
 * are the same single common name, as a UTF8String. It carries **no
 * extensions**: the specification requires none, a browser checking a pinned
 * hash does no path building for basicConstraints or keyUsage to inform, and
 * every extension would be one more field whose absence is part of the
 * contract a hash pins. OpenSSL verifies it as its own trust anchor all the
 * same (`tests/link/crypto_x509`'s header has the commands). The key, the
 * serial and the time are parameters so the golden certificate is
 * deterministic; a caller passes `Date.now()` and, for the key and the serial,
 * bytes from `crypto.getRandomValues`. This module does not draw them itself,
 * because a call to the operating system would stop it compiling for wasm32.
 *
 * **Constant time.** A private key is the one secret that passes through here:
 * it is base64-decoded from PEM, lifted out of its DER, and handed to
 * `nish/crypto/p256`. Base64 maps a character to its sextet and back by
 * arithmetic on range masks, as `nish/crypto/base64url` does, and folds a bad
 * character into one word read after the whole text, so neither a branch nor a
 * table index depends on the key's bytes. PEM's framing is found by comparing
 * the start of each line with the fixed `-----BEGIN ` and `-----END `, which no
 * base64 character matches, so those comparisons end on a line's first byte
 * whatever the key is. The DER reader branches on tags and
 * lengths, which are the key's public framing, and copies its 32 octets with a
 * fixed loop. Signing is `p256SignSha256`, and checking a key against the
 * public key stored beside it compares public values. None of this is under
 * the disassembly check; it is discipline.
 *
 * Private names carry the `x509` prefix because a `std/` module's private
 * functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */
import { p256PublicKey, p256SignSha256, p256VerifySha256 } from "nish/crypto/p256"
import { sha256 } from "nish/crypto/sha256"

/** The longest validity `x509MintSelfSigned` writes, in days: WebTransport's two weeks. */
export const X509_MAX_DAYS: i32 = 14

/** Longest serial number, in content octets of its INTEGER (RFC 5280 §4.1.2.2). */
export const X509_MAX_SERIAL: i32 = 20

/** The longest common name minted, in bytes (RFC 5280 Appendix A's `ub-common-name`). */
const X509_MAX_COMMON_NAME: i32 = 64

/** What a time field reads as when it is not a valid RFC 5280 time: before any year the reader accepts. */
const X509_NO_TIME: i64 = -1000000000000

const X509_MS_PER_DAY: i64 = 86400000

// DER tags (X.690 §8, and the context tags RFC 5280 gives them).
const X509_TAG_INTEGER: i32 = 0x02
const X509_TAG_BIT_STRING: i32 = 0x03
const X509_TAG_OCTET_STRING: i32 = 0x04
const X509_TAG_OID: i32 = 0x06
const X509_TAG_UTF8_STRING: i32 = 0x0c
const X509_TAG_UTC_TIME: i32 = 0x17
const X509_TAG_GENERALIZED_TIME: i32 = 0x18
const X509_TAG_SEQUENCE: i32 = 0x30
const X509_TAG_SET: i32 = 0x31

/**
 * One certificate, as `x509ParseCertificate` and `x509ParseChain` read it.
 * The byte fields are copies, so the certificate outlives the text it was read
 * from. Times are milliseconds since 1970-01-01 UTC, as `Date.now()` counts.
 */
export class X509Certificate {
  /** The whole certificate, as its SHA-256 is taken. */
  der: u8[]
  /** The DER of `tbsCertificate`, the bytes the signature covers. */
  tbs: u8[]
  /** The serial number's INTEGER contents, two's complement as encoded. */
  serial: u8[]
  /** The issuer Name's DER, whole, to compare with another certificate's `subject`. */
  issuer: u8[]
  /** The subject Name's DER, whole. */
  subject: u8[]
  /** The subjectPublicKey BIT STRING's octets: for a P-256 key, the 65-byte uncompressed point. */
  publicKey: u8[]
  /** The signatureValue BIT STRING's octets: for ECDSA, the DER `SEQUENCE { r, s }`. */
  signature: u8[]
  /** The first instant the certificate is valid, inclusive (RFC 5280 §4.1.2.5). */
  notBefore: i64 = 0
  /** The last instant it is valid, inclusive. */
  notAfter: i64 = 0
  /** Whether the key is id-ecPublicKey on prime256v1 (RFC 5480 §2.1.1), so `publicKey` is a P-256 point. */
  p256: boolean = false
  /** Whether the signature algorithm is ecdsa-with-SHA256 with its parameters absent (RFC 5758 §3.2). */
  ecdsaSha256: boolean = false

  constructor() {
    this.der = []
    this.tbs = []
    this.serial = []
    this.issuer = []
    this.subject = []
    this.publicKey = []
    this.signature = []
  }
}

// ---------------------------------------------------------------------------
// DER, reading (X.690 §8 and §10)
// ---------------------------------------------------------------------------

/** One element's identifier octet and where its contents lie: `der[start .. end)`. */
class X509DerElement {
  tag: i32
  /** Where the identifier octet is, so the whole element can be copied. */
  at: i32
  start: i32
  end: i32

  constructor(tag: i32, at: i32, start: i32, end: i32) {
    this.tag = tag
    this.at = at
    this.start = start
    this.end = end
  }
}

/**
 * The element whose identifier octet is at `der[at]`, or `null` unless its
 * header and contents lie in `der[at .. limit)` and its length is DER's: definite
 * (§10.1) and minimal (§8.1.3.5 note 2 with §10.1 — long form only from 128,
 * with no leading zero octet). A tag needing more than one octet is refused,
 * since nothing in a certificate or a key uses one; lengths past 2^31 - 1 are
 * refused before they can overflow.
 */
const x509DerRead = (der: u8[], at: i32, limit: i32): X509DerElement | null => {
  if (at < 0 || limit > toI32(der.length) || at > limit - 2) {
    return null
  }
  const tag: i32 = toI32(der[at])
  if ((tag & 0x1f) === 0x1f) {
    return null
  }
  let length: i32 = toI32(der[at + 1])
  let start: i32 = at + 2
  if (length >= 0x80) {
    const count: i32 = length & 0x7f
    // 0x80 alone is BER's indefinite length, which DER forbids.
    if (count < 1 || count > 4 || count > limit - start) {
      return null
    }
    if (toI32(der[start]) === 0 || (count === 4 && toI32(der[start]) >= 0x80)) {
      return null
    }
    length = 0
    for (let k: i32 = 0; k < count; k++) {
      length = (length << 8) | toI32(der[start + k])
    }
    if (length < 0x80) {
      return null
    }
    start = start + count
  }
  if (length > limit - start) {
    return null
  }
  return new X509DerElement(tag, at, start, start + length)
}

/** `x509DerRead`, answering `null` also when the element's tag is not `tag`. */
const x509DerExpect = (der: u8[], at: i32, limit: i32, tag: i32): X509DerElement | null => {
  const e: X509DerElement | null = x509DerRead(der, at, limit)
  if (e === null || e.tag !== tag) {
    return null
  }
  return e
}

/**
 * The identifier octet at `der[at]` when `at` is inside `der[.. limit)`, else
 * `-1`: how an optional element is looked for.
 */
const x509DerPeek = (der: u8[], at: i32, limit: i32): i32 => {
  if (at < 0 || at >= limit || at >= toI32(der.length)) {
    return -1
  }
  return toI32(der[at])
}

/** A copy of `der[from .. to)`. */
const x509DerSlice = (der: u8[], from: i32, to: i32): u8[] => {
  const out: u8[] = new Array<u8>(to - from)
  for (let k: i32 = 0; k < toI32(out.length); k++) {
    const i: i32 = from + k
    // Always true for the callers' ranges, and what lets the load drop its check.
    if (i >= 0 && i < toI32(der.length)) {
      out[k] = der[i]
    }
  }
  return out
}

/** A copy of the element whole, identifier and length octets included. */
const x509DerWhole = (der: u8[], e: X509DerElement): u8[] => x509DerSlice(der, e.at, e.end)

/** Whether two byte strings are equal. Both are public here. */
const x509BytesEqual = (a: u8[], b: u8[]): boolean => {
  if (toI32(b.length) !== toI32(a.length)) {
    return false
  }
  for (let k: i32 = 0; k < toI32(a.length); k++) {
    if (k < toI32(b.length) && a[k] !== b[k]) {
      return false
    }
  }
  return true
}

/** Whether `e`'s contents are exactly `expected`, as an OID is recognised by its encoding. */
const x509DerContentsAre = (der: u8[], e: X509DerElement, expected: u8[]): boolean => {
  const n: i32 = toI32(expected.length)
  if (e.end - e.start !== n) {
    return false
  }
  for (let k: i32 = 0; k < n; k++) {
    if (der[e.start + k] !== expected[k]) {
      return false
    }
  }
  return true
}

/**
 * Whether an INTEGER's contents are DER's (X.690 §8.3.2): at least one octet,
 * and the first nine bits neither all zero nor all one, which would make the
 * first octet redundant.
 */
const x509DerIntegerMinimal = (der: u8[], e: X509DerElement): boolean => {
  const n: i32 = e.end - e.start
  if (n < 1) {
    return false
  }
  if (n === 1) {
    return true
  }
  const b0: i32 = toI32(der[e.start])
  const b1: i32 = toI32(der[e.start + 1])
  return !((b0 === 0 && b1 < 0x80) || (b0 === 0xff && b1 >= 0x80))
}

/** The value of a one-octet, non-negative INTEGER such as a version, or `-1`. */
const x509DerSmallInteger = (der: u8[], e: X509DerElement): i32 => {
  if (e.tag !== X509_TAG_INTEGER || e.end - e.start !== 1 || toI32(der[e.start]) >= 0x80) {
    return -1
  }
  return toI32(der[e.start])
}

/**
 * The octets of a BIT STRING that has no unused bits, or `null`. Keys and
 * signatures are whole octets, so the leading unused-bits count must be 0.
 */
const x509DerBitStringOctets = (der: u8[], e: X509DerElement): u8[] | null => {
  if (e.tag !== X509_TAG_BIT_STRING || e.end - e.start < 1 || toI32(der[e.start]) !== 0) {
    return null
  }
  return x509DerSlice(der, e.start + 1, e.end)
}

/** `count` decimal digits at `der[at ..)` as a number, or `-1` if any is not a digit. */
const x509DerDigits = (der: u8[], at: i32, count: i32): i32 => {
  let value: i32 = 0
  for (let k: i32 = 0; k < count; k++) {
    const d: i32 = toI32(der[at + k]) - 48
    if (d < 0 || d > 9) {
      return -1
    }
    value = value * 10 + d
  }
  return value
}

/** Whether `year` is a leap year of the Gregorian calendar. */
const x509IsLeapYear = (year: i32): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/** Days in `month` (1 to 12) of `year`. */
const x509DaysInMonth = (year: i32, month: i32): i32 => {
  if (month === 2) {
    return x509IsLeapYear(year) ? 29 : 28
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

/**
 * Days from 1970-01-01 to `year`-`month`-`day`: the days of the years between,
 * counted by the leap-year rule over whole years before each, and then the
 * months of the year itself. `year` is at least 1.
 */
const x509DaysFromCivil = (year: i32, month: i32, day: i32): i32 => {
  const y: i32 = year - 1
  const before: i32 = 365 * y + y / 4 - y / 100 + y / 400
  // 1969 * 365 + 492 - 19 + 4: the same count for 1970.
  let days: i32 = before - 719162
  for (let m: i32 = 1; m < month; m++) {
    days = days + x509DaysInMonth(year, m)
  }
  return days + day - 1
}

/**
 * A UTCTime or GeneralizedTime in the forms RFC 5280 §4.1.2.5 allows —
 * `YYMMDDHHMMSSZ` and `YYYYMMDDHHMMSSZ`, in UTC, with seconds and without a
 * fraction — as milliseconds since 1970, or `X509_NO_TIME`. A two-digit year
 * of 50 or more is 19YY and below 50 is 20YY (§4.1.2.5.1). Both forms are
 * accepted for any year from 1950, though §4.1.2.5 asks issuers to use UTCTime
 * through 2049; the fields must name a real date and a time before 24:00:00.
 */
const x509DerTime = (der: u8[], e: X509DerElement): i64 => {
  const n: i32 = e.end - e.start
  let at: i32 = e.start
  let year: i32 = 0
  if (e.tag === X509_TAG_UTC_TIME && n === 13) {
    year = x509DerDigits(der, at, 2)
    if (year >= 0) {
      year = year + (year >= 50 ? 1900 : 2000)
    }
    at = at + 2
  } else if (e.tag === X509_TAG_GENERALIZED_TIME && n === 15) {
    year = x509DerDigits(der, at, 4)
    at = at + 4
  } else {
    return X509_NO_TIME
  }
  const month: i32 = x509DerDigits(der, at, 2)
  const day: i32 = x509DerDigits(der, at + 2, 2)
  const hour: i32 = x509DerDigits(der, at + 4, 2)
  const minute: i32 = x509DerDigits(der, at + 6, 2)
  const second: i32 = x509DerDigits(der, at + 8, 2)
  if (toI32(der[at + 10]) !== 90 || year < 1950 || month < 1 || month > 12) {
    return X509_NO_TIME
  }
  if (day < 1 || day > x509DaysInMonth(year, month) || hour < 0 || hour > 23) {
    return X509_NO_TIME
  }
  if (minute < 0 || minute > 59 || second < 0 || second > 59) {
    return X509_NO_TIME
  }
  const seconds: i32 = hour * 3600 + minute * 60 + second
  return toI64(x509DaysFromCivil(year, month, day)) * X509_MS_PER_DAY + toI64(seconds) * 1000
}

/**
 * The OID's contents octets (X.690 §8.19): the first two arcs as one
 * subidentifier `40 * a + b`, then each arc in base 128, big-endian, with the
 * top bit set on every octet but its last.
 */
const x509DerOidContents = (arcs: i32[]): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 1; i < toI32(arcs.length); i++) {
    const arc: i32 = i === 1 ? arcs[0] * 40 + arcs[1] : arcs[i]
    let shift: i32 = 28
    while (shift > 0 && arc >> shift === 0) {
      shift = shift - 7
    }
    while (shift > 0) {
      out.push(toU8(((arc >> shift) & 0x7f) | 0x80))
      shift = shift - 7
    }
    out.push(toU8(arc & 0x7f))
  }
  return out
}

/** ecdsa-with-SHA256, 1.2.840.10045.4.3.2 (RFC 5758 §3.2). */
const x509OidEcdsaSha256 = (): u8[] => x509DerOidContents([1, 2, 840, 10045, 4, 3, 2])

/** id-ecPublicKey, 1.2.840.10045.2.1 (RFC 5480 §2.1.1). */
const x509OidEcPublicKey = (): u8[] => x509DerOidContents([1, 2, 840, 10045, 2, 1])

/** secp256r1, also called prime256v1 and P-256: 1.2.840.10045.3.1.7 (RFC 5480 §2.1.1.1). */
const x509OidPrime256v1 = (): u8[] => x509DerOidContents([1, 2, 840, 10045, 3, 1, 7])

/** id-at-commonName, 2.5.4.3 (RFC 5280 Appendix A). */
const x509OidCommonName = (): u8[] => x509DerOidContents([2, 5, 4, 3])

/**
 * Whether `der[start .. end)` is exactly one OID element equal to `oid` and
 * nothing after it.
 */
const x509DerIsOnlyOid = (der: u8[], start: i32, end: i32, oid: u8[]): boolean => {
  const e: X509DerElement | null = x509DerExpect(der, start, end, X509_TAG_OID)
  return e !== null && e.end === end && x509DerContentsAre(der, e, oid)
}

/**
 * Whether an AlgorithmIdentifier SEQUENCE is `{ oid, params }` with `params`
 * the named-curve OID given, or `{ oid }` alone when `params` is empty.
 */
const x509DerIsAlgorithm = (der: u8[], alg: X509DerElement, oid: u8[], params: u8[]): boolean => {
  if (alg.tag !== X509_TAG_SEQUENCE) {
    return false
  }
  const id: X509DerElement | null = x509DerExpect(der, alg.start, alg.end, X509_TAG_OID)
  if (id === null || !x509DerContentsAre(der, id, oid)) {
    return false
  }
  if (toI32(params.length) === 0) {
    return id.end === alg.end
  }
  return x509DerIsOnlyOid(der, id.end, alg.end, params)
}

/**
 * A minimal, non-negative INTEGER right-aligned into `out[off .. off + 32)`,
 * or `false` when it is negative, not minimal or wider than 32 octets once a
 * sign octet is set aside.
 */
const x509DerUnsignedInto = (der: u8[], e: X509DerElement, out: u8[], off: i32): boolean => {
  if (!x509DerIntegerMinimal(der, e) || toI32(der[e.start]) >= 0x80) {
    return false
  }
  let start: i32 = e.start
  if (toI32(der[start]) === 0 && e.end - start > 1) {
    start = start + 1
  }
  const n: i32 = e.end - start
  if (n > 32) {
    return false
  }
  for (let k: i32 = 0; k < n; k++) {
    out[off + 32 - n + k] = der[start + k]
  }
  return true
}

/**
 * `r || s`, 32 octets each, out of an ECDSA-Sig-Value `SEQUENCE { INTEGER r,
 * INTEGER s }` (RFC 5480 §2.2 by way of RFC 3279 §2.2.3), or `null` unless it
 * is exactly one with both integers minimal, positive and below 2^256. This is
 * the form a TLS `CertificateVerify` or an X.509 signature carries, and
 * `nish/crypto/p256` takes the `r || s` it answers.
 */
export const x509DerSignatureRS = (sig: u8[]): u8[] | null => {
  const total: i32 = toI32(sig.length)
  const seq: X509DerElement | null = x509DerExpect(sig, 0, total, X509_TAG_SEQUENCE)
  if (seq === null || seq.end !== total) {
    return null
  }
  const r: X509DerElement | null = x509DerExpect(sig, seq.start, seq.end, X509_TAG_INTEGER)
  if (r === null) {
    return null
  }
  const s: X509DerElement | null = x509DerExpect(sig, r.end, seq.end, X509_TAG_INTEGER)
  if (s === null || s.end !== seq.end) {
    return null
  }
  const out: u8[] = new Array<u8>(64)
  if (!x509DerUnsignedInto(sig, r, out, 0) || !x509DerUnsignedInto(sig, s, out, 32)) {
    return null
  }
  return out
}

// ---------------------------------------------------------------------------
// DER, writing
// ---------------------------------------------------------------------------

/** One element: `tag`, the minimal definite length of `contents` (X.690 §10.1), and `contents`. */
const x509DerTlv = (tag: i32, contents: u8[]): u8[] => {
  const n: i32 = toI32(contents.length)
  const out: u8[] = [toU8(tag)]
  if (n < 0x80) {
    out.push(toU8(n))
  } else {
    let count: i32 = 0
    for (let v: i32 = n; v > 0; v = v >> 8) {
      count = count + 1
    }
    out.push(toU8(0x80 | count))
    for (let k: i32 = count - 1; k >= 0; k--) {
      out.push(toU8((n >> (8 * k)) & 0xff))
    }
  }
  for (let k: i32 = 0; k < toI32(contents.length); k++) {
    out.push(contents[k])
  }
  return out
}

/** `parts` end to end. */
const x509DerConcat = (parts: u8[][]): u8[] => {
  const out: u8[] = []
  for (const part of parts) {
    for (let k: i32 = 0; k < toI32(part.length); k++) {
      out.push(part[k])
    }
  }
  return out
}

/** A constructed element around `parts`: a SEQUENCE, a SET or an explicit context tag. */
const x509DerWrap = (tag: i32, parts: u8[][]): u8[] => x509DerTlv(tag, x509DerConcat(parts))

/**
 * The INTEGER holding the non-negative big-endian `magnitude`: its leading
 * zero octets dropped, and one put back when the top bit would read as a sign
 * (X.690 §8.3). Zero is the single octet `00`.
 */
const x509DerUnsignedInteger = (magnitude: u8[]): u8[] => {
  const contents: u8[] = []
  for (let k: i32 = 0; k < toI32(magnitude.length); k++) {
    const octet: i32 = toI32(magnitude[k])
    // The first significant octet: a sign octet in front of it if its top bit is set.
    if (toI32(contents.length) === 0 && octet >= 0x80) {
      contents.push(0)
    }
    if (toI32(contents.length) > 0 || octet !== 0) {
      contents.push(toU8(octet))
    }
  }
  if (toI32(contents.length) === 0) {
    contents.push(0)
  }
  return x509DerTlv(X509_TAG_INTEGER, contents)
}

/** A BIT STRING of whole `octets`: the unused-bits count 0, then the octets. */
const x509DerBitString = (octets: u8[]): u8[] => {
  const contents: u8[] = [0]
  for (let k: i32 = 0; k < toI32(octets.length); k++) {
    contents.push(octets[k])
  }
  return x509DerTlv(X509_TAG_BIT_STRING, contents)
}

/** `value` as `width` decimal digits, pushed onto `out`. */
const x509PushDigits = (out: u8[], value: i32, width: i32): void => {
  let scale: i32 = 1
  for (let k: i32 = 1; k < width; k++) {
    scale = scale * 10
  }
  for (let k: i32 = 0; k < width; k++) {
    out.push(toU8(((value / scale) % 10) + 48))
    scale = scale / 10
  }
}

/**
 * The Time for `seconds` after 1970 (not negative, at most the last second of
 * 9999), as RFC 5280 §4.1.2.5 has an issuer write it: UTCTime through 2049,
 * GeneralizedTime from 2050, both in UTC with seconds.
 */
const x509DerTimeAt = (seconds: i64): u8[] => {
  let days: i32 = toI32(seconds / 86400)
  const rest: i32 = toI32(seconds % 86400)
  let year: i32 = 1970
  while (days >= (x509IsLeapYear(year) ? 366 : 365)) {
    days = days - (x509IsLeapYear(year) ? 366 : 365)
    year = year + 1
  }
  let month: i32 = 1
  while (days >= x509DaysInMonth(year, month)) {
    days = days - x509DaysInMonth(year, month)
    month = month + 1
  }
  const text: u8[] = []
  const utc: boolean = year < 2050
  x509PushDigits(text, utc ? year % 100 : year, utc ? 2 : 4)
  x509PushDigits(text, month, 2)
  x509PushDigits(text, days + 1, 2)
  x509PushDigits(text, rest / 3600, 2)
  x509PushDigits(text, (rest / 60) % 60, 2)
  x509PushDigits(text, rest % 60, 2)
  text.push(90)
  return x509DerTlv(utc ? X509_TAG_UTC_TIME : X509_TAG_GENERALIZED_TIME, text)
}

/**
 * Whether `bytes` is well-formed UTF-8 (RFC 3629 §4) with no NUL: no stray
 * continuation octet, no truncated sequence, no overlong form, no surrogate and
 * nothing past U+10FFFF. A string in the language is bytes and need not be
 * UTF-8, and a UTF8String that is not UTF-8 is a malformed certificate; a NUL
 * is refused because a name that reads differently to C is the old
 * `localhost\0.example` confusion.
 */
const x509IsUtf8Name = (bytes: u8[]): boolean => {
  // Continuation octets still owed, and the range the next one must fall in:
  // 80..BF, narrowed after E0, ED, F0 and F4 (Unicode 15 §3.9, Table 3-7).
  let need: i32 = 0
  let lo: i32 = 0x80
  let hi: i32 = 0xbf
  for (let k: i32 = 0; k < toI32(bytes.length); k++) {
    const b: i32 = toI32(bytes[k])
    if (need > 0) {
      if (b < lo || b > hi) {
        return false
      }
      need = need - 1
      lo = 0x80
      hi = 0xbf
    } else if (b === 0) {
      return false
    } else if (b >= 0xc2 && b <= 0xdf) {
      need = 1
    } else if (b >= 0xe0 && b <= 0xef) {
      need = 2
      lo = b === 0xe0 ? 0xa0 : 0x80
      hi = b === 0xed ? 0x9f : 0xbf
    } else if (b >= 0xf0 && b <= 0xf4) {
      need = 3
      lo = b === 0xf0 ? 0x90 : 0x80
      hi = b === 0xf4 ? 0x8f : 0xbf
    } else if (b >= 0x80) {
      return false
    }
  }
  return need === 0
}

/** The bytes of `text`, as the language holds a string. */
const x509Bytes = (text: string): u8[] => {
  const out: u8[] = []
  const n: i32 = toI32(text.length)
  for (let k: i32 = 0; k < n; k++) {
    out.push(toU8(toI32(text.charCodeAt(k))))
  }
  return out
}

// ---------------------------------------------------------------------------
// PEM (RFC 7468) and standard base64 (RFC 4648 §4)
// ---------------------------------------------------------------------------

/** All ones when `lo <= c <= hi`, else zero, without a branch; `c` is a byte or a sextet. */
const x509RangeMask = (c: i32, lo: i32, hi: i32): i32 => ((lo - 1 - c) & (c - hi - 1)) >> 31

/**
 * The base64 character for the sextet `v`: `'A' + v`, stepped by the gap to
 * each later range it has reached — 26 lands on `a`, 52 on `0`, 62 on `+` and
 * 63 on `/`.
 */
const x509Base64CharOf = (v: i32): i32 =>
  65 +
  v +
  (x509RangeMask(v, 26, 63) & 6) -
  (x509RangeMask(v, 52, 63) & 75) -
  (x509RangeMask(v, 62, 63) & 15) +
  (x509RangeMask(v, 63, 63) & 3)

/** The sextet the byte `c` stands for in base64, or `-1` when it is not in the alphabet. */
const x509Base64SextetOf = (c: i32): i32 => {
  const upper: i32 = x509RangeMask(c, 65, 90)
  const lower: i32 = x509RangeMask(c, 97, 122)
  const digit: i32 = x509RangeMask(c, 48, 57)
  const plus: i32 = x509RangeMask(c, 43, 43)
  const slash: i32 = x509RangeMask(c, 47, 47)
  const value: i32 = (upper & (c - 65)) | (lower & (c - 71)) | (digit & (c + 4)) | (plus & 62) | (slash & 63)
  return value | ~(upper | lower | digit | plus | slash)
}

/** `data` in padded base64, as one line. */
const x509Base64Encode = (data: u8[]): string => {
  const parts: string[] = []
  let acc: i32 = 0
  let bits: i32 = 0
  for (let k: i32 = 0; k < toI32(data.length); k++) {
    acc = ((acc << 8) | toI32(data[k])) & 0xfff
    bits = bits + 8
    while (bits >= 6) {
      bits = bits - 6
      parts.push(String.fromCharCode(x509Base64CharOf((acc >> bits) & 63)))
    }
  }
  if (bits > 0) {
    parts.push(String.fromCharCode(x509Base64CharOf((acc << (6 - bits)) & 63)))
  }
  // One `=` for a final group of two bytes, two for one byte.
  const tail: i32 = toI32(data.length) % 3
  if (tail > 0) {
    parts.push(tail === 1 ? "==" : "=")
  }
  return parts.join("")
}

/**
 * The bytes of padded base64 `text`, or `null` unless it is the one canonical
 * spelling of them: a whole number of four-character groups, `=` only as the
 * last one or two characters, every other character in the alphabet, and the
 * bits the padding leaves over all zero (RFC 4648 §3.5). Where the padding is
 * depends on the length alone; the characters themselves are read by masks and
 * judged once, after the last.
 */
const x509Base64Decode = (text: string): u8[] | null => {
  const n: i32 = toI32(text.length)
  if (n === 0 || (n & 3) !== 0) {
    return null
  }
  let pad: i32 = 0
  if (toI32(text.charCodeAt(n - 1)) === 61) {
    pad = toI32(text.charCodeAt(n - 2)) === 61 ? 2 : 1
  }
  const chars: i32 = n - pad
  const out: u8[] = new Array<u8>((n >> 2) * 3 - pad)
  const outLen: i32 = toI32(out.length)
  let bad: i32 = 0
  let acc: i32 = 0
  let bits: i32 = 0
  let j: i32 = 0
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    // The padding is past `chars`, and is not data; which positions those are
    // is a fact about the length.
    if (k < chars) {
      const v: i32 = x509Base64SextetOf(toI32(text.charCodeAt(k)))
      bad = bad | (v >> 31)
      acc = ((acc << 6) | (v & 63)) & 0xfff
      bits = bits + 6
      if (bits >= 8) {
        bits = bits - 8
        // Always true — `out` was sized from the same length — and written so
        // the store keeps no bounds check.
        if (j >= 0 && j < outLen) {
          out[j] = toU8((acc >> bits) & 0xff)
        }
        j = j + 1
      }
    }
  }
  bad = bad | (acc & ((1 << bits) - 1))
  if (bad !== 0) {
    return null
  }
  return out
}

/** Whether `text` starts with `prefix`. */
const x509StartsWith = (text: string, prefix: string): boolean => {
  const n: i32 = toI32(prefix.length)
  return toI32(text.length) >= n && text.substring(0, n) === prefix
}

/** Whether `text` ends with `suffix`. */
const x509EndsWith = (text: string, suffix: string): boolean => {
  const n: i32 = toI32(text.length)
  const m: i32 = toI32(suffix.length)
  return n >= m && text.substring(n - m, n) === suffix
}

/**
 * `der` as a PEM block (RFC 7468 §2): `-----BEGIN label-----`, the base64 of
 * the DER in lines of 64 characters, and `-----END label-----`, each line
 * ending in a line feed.
 */
export const derToPem = (der: u8[], label: string): string => {
  const body: string = x509Base64Encode(der)
  const n: i32 = toI32(body.length)
  const lines: string[] = [`-----BEGIN ${label}-----`]
  for (let at: i32 = 0; at < n; at = at + 64) {
    lines.push(body.substring(at, at + 64 < n ? at + 64 : n))
  }
  lines.push(`-----END ${label}-----`)
  lines.push("")
  return lines.join("\n")
}

/**
 * The DER of every PEM block in `pem` whose label is exactly `label`, in the
 * order they appear, or `null` when there is none or any block is malformed:
 * an unterminated block, an END whose label is not its BEGIN's, a line longer
 * than 64 characters or a short line before the last, a header line, or
 * base64 that is not canonical. Blocks with other labels must be as well
 * formed, and are skipped; so is text outside the blocks.
 */
export const pemToDer = (pem: string, label: string): u8[][] | null => {
  const out: u8[][] = []
  const n: i32 = toI32(pem.length)
  // The label of the block being read, or "" outside one; its body lines so far.
  let inside: string = ""
  let body: string[] = []
  let shortSeen: boolean = false
  let lineStart: i32 = 0
  while (lineStart < n) {
    let lineEnd: i32 = lineStart
    while (lineEnd >= 0 && lineEnd < toI32(pem.length) && toI32(pem.charCodeAt(lineEnd)) !== 10) {
      lineEnd = lineEnd + 1
    }
    const next: i32 = lineEnd + 1
    if (lineEnd > lineStart && toI32(pem.charCodeAt(lineEnd - 1)) === 13) {
      lineEnd = lineEnd - 1
    }
    const line: string = pem.slice(lineStart, lineEnd)
    lineStart = next
    const length: i32 = toI32(line.length)
    if (inside === "") {
      if (x509StartsWith(line, "-----BEGIN ") && x509EndsWith(line, "-----") && length > 16) {
        inside = line.substring(11, length - 5)
        body = []
        shortSeen = false
      } else if (x509StartsWith(line, "-----END ")) {
        return null
      }
    } else if (x509StartsWith(line, "-----END ")) {
      if (line !== `-----END ${inside}-----`) {
        return null
      }
      // Every block is decoded, whatever its label: a malformed block beside the
      // one asked for is refused, not skipped (docs/security/crypto-x509.md, X509-1).
      const der: u8[] | null = x509Base64Decode(body.join(""))
      if (der === null) {
        return null
      }
      if (inside === label) {
        out.push(der)
      }
      inside = ""
    } else {
      if (shortSeen || length < 1 || length > 64) {
        return null
      }
      shortSeen = length < 64
      body.push(line)
    }
  }
  if (inside !== "" || toI32(out.length) === 0) {
    return null
  }
  return out
}

// ---------------------------------------------------------------------------
// Private keys (RFC 5915, RFC 5208 / RFC 5958)
// ---------------------------------------------------------------------------

/**
 * The 32-byte scalar of an ECPrivateKey (RFC 5915 §3) filling `der[start ..
 * end)`: version 1, the key as an OCTET STRING of exactly 32 octets, the
 * optional `[0]` parameters, which must name prime256v1 and are required when
 * `needCurve` (a bare SEC1 key has nowhere else to say its curve), and the
 * optional `[1]` public key, which must be the key's own. `null` otherwise,
 * or when the scalar is 0 or not below n.
 */
const x509Sec1Key = (der: u8[], start: i32, end: i32, needCurve: boolean): u8[] | null => {
  const seq: X509DerElement | null = x509DerExpect(der, start, end, X509_TAG_SEQUENCE)
  if (seq === null || seq.end !== end) {
    return null
  }
  const version: X509DerElement | null = x509DerRead(der, seq.start, seq.end)
  if (version === null || x509DerSmallInteger(der, version) !== 1) {
    return null
  }
  const key: X509DerElement | null = x509DerExpect(der, version.end, seq.end, X509_TAG_OCTET_STRING)
  if (key === null || key.end - key.start !== 32) {
    return null
  }
  const priv: u8[] = x509DerSlice(der, key.start, key.end)
  let at: i32 = key.end
  let curve: boolean = false
  let stored: u8[] | null = null
  if (x509DerPeek(der, at, seq.end) === 0xa0) {
    const params: X509DerElement | null = x509DerRead(der, at, seq.end)
    if (params === null || !x509DerIsOnlyOid(der, params.start, params.end, x509OidPrime256v1())) {
      return null
    }
    curve = true
    at = params.end
  }
  if (x509DerPeek(der, at, seq.end) === 0xa1) {
    const wrapper: X509DerElement | null = x509DerRead(der, at, seq.end)
    if (wrapper === null) {
      return null
    }
    const bits: X509DerElement | null = x509DerExpect(der, wrapper.start, wrapper.end, X509_TAG_BIT_STRING)
    if (bits === null || bits.end !== wrapper.end) {
      return null
    }
    stored = x509DerBitStringOctets(der, bits)
    if (stored === null) {
      return null
    }
    at = wrapper.end
  }
  if (at !== seq.end || (needCurve && !curve)) {
    return null
  }
  // Refuses 0 and n and above, and gives the point to hold `stored` against.
  const pub: u8[] | null = p256PublicKey(priv)
  if (pub === null) {
    return null
  }
  if (stored !== null && !x509BytesEqual(stored, pub)) {
    return null
  }
  return priv
}

/**
 * The scalar of a PKCS#8 PrivateKeyInfo (RFC 5208 §5) or OneAsymmetricKey
 * (RFC 5958 §2): version 0 or 1, the algorithm id-ecPublicKey with the
 * prime256v1 curve, and an ECPrivateKey inside the OCTET STRING, followed by
 * the optional `[0]` attributes and — in version 1 — `[1]` public key, which
 * are skipped.
 */
const x509Pkcs8Key = (der: u8[]): u8[] | null => {
  const total: i32 = toI32(der.length)
  const seq: X509DerElement | null = x509DerExpect(der, 0, total, X509_TAG_SEQUENCE)
  if (seq === null || seq.end !== total) {
    return null
  }
  const version: X509DerElement | null = x509DerRead(der, seq.start, seq.end)
  if (version === null) {
    return null
  }
  const v: i32 = x509DerSmallInteger(der, version)
  if (v !== 0 && v !== 1) {
    return null
  }
  const alg: X509DerElement | null = x509DerRead(der, version.end, seq.end)
  if (alg === null || !x509DerIsAlgorithm(der, alg, x509OidEcPublicKey(), x509OidPrime256v1())) {
    return null
  }
  const key: X509DerElement | null = x509DerExpect(der, alg.end, seq.end, X509_TAG_OCTET_STRING)
  if (key === null) {
    return null
  }
  let at: i32 = key.end
  if (x509DerPeek(der, at, seq.end) === 0xa0) {
    const attributes: X509DerElement | null = x509DerRead(der, at, seq.end)
    if (attributes === null) {
      return null
    }
    at = attributes.end
  }
  if (v === 1 && x509DerPeek(der, at, seq.end) === 0x81) {
    const pub: X509DerElement | null = x509DerRead(der, at, seq.end)
    if (pub === null) {
      return null
    }
    at = pub.end
  }
  if (at !== seq.end) {
    return null
  }
  return x509Sec1Key(der, key.start, key.end, false)
}

/**
 * The 32-byte P-256 private key in `pem`: one `EC PRIVATE KEY` block (SEC1,
 * RFC 5915, which must name its curve) or one `PRIVATE KEY` block (unencrypted
 * PKCS#8, RFC 5208 or RFC 5958), and not both. `null` for no such block or
 * more than one, for any curve but P-256, for a scalar of 0 or n or more, for
 * a stored public key that is not the key's own, and for anything malformed.
 * An `ENCRYPTED PRIVATE KEY` is a different label, and answers `null`.
 */
export const x509ParseP256PrivateKey = (pem: string): u8[] | null => {
  const sec1: u8[][] | null = pemToDer(pem, "EC PRIVATE KEY")
  const pkcs8: u8[][] | null = pemToDer(pem, "PRIVATE KEY")
  if (sec1 !== null && pkcs8 === null && toI32(sec1.length) === 1) {
    const der: u8[] = sec1[0]
    return x509Sec1Key(der, 0, toI32(der.length), true)
  }
  if (pkcs8 !== null && sec1 === null && toI32(pkcs8.length) === 1) {
    return x509Pkcs8Key(pkcs8[0])
  }
  return null
}

// ---------------------------------------------------------------------------
// Certificates (RFC 5280 §4.1)
// ---------------------------------------------------------------------------

/**
 * Whether a unique identifier or the extensions wrapper after the key is well
 * formed as far as its outer shape: an IMPLICIT BIT STRING (`0x81`, `0x82`)
 * has an unused-bits count of 0 to 7, no unused bits without an octet to hold
 * them, and those bits zero; `[3]` (`0xa3`) is one non-empty SEQUENCE and
 * nothing after it (RFC 5280 §4.1's `SIZE (1..MAX)`). What an extension says
 * is not read.
 */
const x509DerTrailingSound = (der: u8[], e: X509DerElement): boolean => {
  if (e.tag !== 0xa3) {
    if (e.end - e.start < 1) {
      return false
    }
    const unused: i32 = toI32(der[e.start])
    if (unused === 0 || e.end - e.start === 1) {
      return unused === 0
    }
    // DER (X.690 §11.2.1) sets the unused bits of the last octet to zero.
    return unused <= 7 && (toI32(der[e.end - 1]) & ((1 << unused) - 1)) === 0
  }
  const seq: X509DerElement | null = x509DerExpect(der, e.start, e.end, X509_TAG_SEQUENCE)
  return seq !== null && seq.end === e.end && seq.end > seq.start
}

/**
 * `der` read as one Certificate (RFC 5280 §4.1), or `null` unless it is
 * exactly one in DER: `SEQUENCE { tbsCertificate, signatureAlgorithm,
 * signatureValue }`, where tbsCertificate holds an explicit version of v2 or
 * v3 or none (DER omits v1, the default), a minimal serial, an algorithm equal
 * to the outer one byte for byte (§4.1.1.2), issuer and subject Names, a
 * Validity of two valid times, a SubjectPublicKeyInfo whose key is whole
 * octets, then only the optional `[1]` and `[2]` unique identifiers (v2 and
 * v3) and `[3]` extensions (v3), in that order, each well formed on the
 * outside. Any algorithm and key type is read; `p256` and `ecdsaSha256` say
 * whether they are this module's.
 *
 * **A parser, not a validator.** It checks that the bytes are one certificate
 * and nothing else. It does not check the signature (`x509VerifySignature`
 * does), that `notBefore` is not after `notAfter` or that either is near any
 * clock, and it does not read extensions — basicConstraints, keyUsage,
 * subjectAltName and the critical flag RFC 5280 §4.2 obliges a verifier to
 * honour are neither checked nor exposed.
 */
export const x509ParseCertificate = (der: u8[]): X509Certificate | null => {
  const total: i32 = toI32(der.length)
  const cert: X509DerElement | null = x509DerExpect(der, 0, total, X509_TAG_SEQUENCE)
  if (cert === null || cert.end !== total) {
    return null
  }
  const tbs: X509DerElement | null = x509DerExpect(der, cert.start, cert.end, X509_TAG_SEQUENCE)
  if (tbs === null) {
    return null
  }
  const outerAlg: X509DerElement | null = x509DerExpect(der, tbs.end, cert.end, X509_TAG_SEQUENCE)
  if (outerAlg === null) {
    return null
  }
  const sigValue: X509DerElement | null = x509DerExpect(der, outerAlg.end, cert.end, X509_TAG_BIT_STRING)
  if (sigValue === null || sigValue.end !== cert.end) {
    return null
  }
  const signature: u8[] | null = x509DerBitStringOctets(der, sigValue)
  if (signature === null) {
    return null
  }

  let at: i32 = tbs.start
  let version: i32 = 0
  if (x509DerPeek(der, at, tbs.end) === 0xa0) {
    const explicit: X509DerElement | null = x509DerRead(der, at, tbs.end)
    if (explicit === null) {
      return null
    }
    const inner: X509DerElement | null = x509DerRead(der, explicit.start, explicit.end)
    if (inner === null || inner.end !== explicit.end) {
      return null
    }
    version = x509DerSmallInteger(der, inner)
    if (version !== 1 && version !== 2) {
      return null
    }
    at = explicit.end
  }
  const serial: X509DerElement | null = x509DerExpect(der, at, tbs.end, X509_TAG_INTEGER)
  if (serial === null || !x509DerIntegerMinimal(der, serial)) {
    return null
  }
  const alg: X509DerElement | null = x509DerExpect(der, serial.end, tbs.end, X509_TAG_SEQUENCE)
  if (alg === null || !x509BytesEqual(x509DerWhole(der, alg), x509DerWhole(der, outerAlg))) {
    return null
  }
  const issuer: X509DerElement | null = x509DerExpect(der, alg.end, tbs.end, X509_TAG_SEQUENCE)
  if (issuer === null) {
    return null
  }
  const validity: X509DerElement | null = x509DerExpect(der, issuer.end, tbs.end, X509_TAG_SEQUENCE)
  if (validity === null) {
    return null
  }
  const notBefore: X509DerElement | null = x509DerRead(der, validity.start, validity.end)
  if (notBefore === null) {
    return null
  }
  const notAfter: X509DerElement | null = x509DerRead(der, notBefore.end, validity.end)
  if (notAfter === null || notAfter.end !== validity.end) {
    return null
  }
  const subject: X509DerElement | null = x509DerExpect(der, validity.end, tbs.end, X509_TAG_SEQUENCE)
  if (subject === null) {
    return null
  }
  const spki: X509DerElement | null = x509DerExpect(der, subject.end, tbs.end, X509_TAG_SEQUENCE)
  if (spki === null) {
    return null
  }
  const keyAlg: X509DerElement | null = x509DerExpect(der, spki.start, spki.end, X509_TAG_SEQUENCE)
  if (keyAlg === null) {
    return null
  }
  const keyBits: X509DerElement | null = x509DerExpect(der, keyAlg.end, spki.end, X509_TAG_BIT_STRING)
  if (keyBits === null || keyBits.end !== spki.end) {
    return null
  }
  const publicKey: u8[] | null = x509DerBitStringOctets(der, keyBits)
  if (publicKey === null) {
    return null
  }
  at = spki.end
  // [1] issuerUniqueID and [2] subjectUniqueID are IMPLICIT BIT STRINGs (so
  // primitive, 0x81 and 0x82) from v2; [3] extensions is explicit (0xa3), v3.
  // `x509DerTrailingSound` holds each to its shape.
  const trailing: i32[] = [0x81, 0x82, 0xa3]
  for (let i: i32 = 0; i < 3; i++) {
    if (x509DerPeek(der, at, tbs.end) === trailing[i]) {
      const e: X509DerElement | null = x509DerRead(der, at, tbs.end)
      if (e === null || version < (i === 2 ? 2 : 1) || !x509DerTrailingSound(der, e)) {
        return null
      }
      at = e.end
    }
  }
  if (at !== tbs.end) {
    return null
  }

  const before: i64 = x509DerTime(der, notBefore)
  const after: i64 = x509DerTime(der, notAfter)
  if (before === X509_NO_TIME || after === X509_NO_TIME) {
    return null
  }
  const out = new X509Certificate()
  out.der = x509DerSlice(der, 0, total)
  out.tbs = x509DerWhole(der, tbs)
  out.serial = x509DerSlice(der, serial.start, serial.end)
  out.issuer = x509DerWhole(der, issuer)
  out.subject = x509DerWhole(der, subject)
  out.publicKey = publicKey
  out.p256 = x509DerIsAlgorithm(der, keyAlg, x509OidEcPublicKey(), x509OidPrime256v1())
  out.notBefore = before
  out.notAfter = after
  out.signature = signature
  out.ecdsaSha256 = x509DerIsAlgorithm(der, outerAlg, x509OidEcdsaSha256(), [])
  return out
}

/**
 * Every `CERTIFICATE` block in `pem`, in the order they appear — for a
 * server's chain file, leaf first as TLS sends it — or `null` when there is
 * none, or when any block is not PEM `pemToDer` accepts or a certificate
 * `x509ParseCertificate` accepts.
 *
 * **It reads a chain; it does not validate one.** Nothing relates one
 * certificate to the next: not the order, not that each is issued by the one
 * after it (issuer against subject, or signature), not validity against a
 * clock, basicConstraints, keyUsage, name constraints or a trust anchor. RFC
 * 5280 §6's path validation is not in this module, and a chain it answers is
 * no evidence that anyone vouches for the leaf.
 */
export const x509ParseChain = (pem: string): X509Certificate[] | null => {
  const blocks: u8[][] | null = pemToDer(pem, "CERTIFICATE")
  if (blocks === null) {
    return null
  }
  const out: X509Certificate[] = []
  for (const der of blocks) {
    const cert: X509Certificate | null = x509ParseCertificate(der)
    if (cert === null) {
      return null
    }
    out.push(cert)
  }
  return out
}

/**
 * Whether `cert`'s signature is a valid ecdsa-with-SHA256 signature of its TBS
 * bytes under `issuer`'s P-256 key — a self-signed certificate passes itself
 * as both. `false` for any other algorithm or key, and for a signature that is
 * not a DER ECDSA-Sig-Value. Only the signature: that `cert.issuer` is
 * `issuer.subject` and that the times hold are fields the caller compares, and
 * whether `issuer` may issue at all (basicConstraints, keyUsage) is in
 * extensions this module does not read, so a `true` here is not path
 * validation.
 */
export const x509VerifySignature = (cert: X509Certificate, issuer: X509Certificate): boolean => {
  if (!cert.ecdsaSha256 || !issuer.p256) {
    return false
  }
  const rs: u8[] | null = x509DerSignatureRS(cert.signature)
  if (rs === null) {
    return false
  }
  return p256VerifySha256(issuer.publicKey, cert.tbs, rs)
}

/**
 * A self-signed X.509 v3 certificate, in DER, for the P-256 key `priv`: subject
 * and issuer `CN=commonName`, valid from `notBeforeMs` (milliseconds since
 * 1970, rounded down to the second) for exactly `days` days, serial number
 * `serial`, and signed with ecdsa-with-SHA256 — see the module comment for why
 * it has no extensions. `null` when `days` is below 1 or above
 * `X509_MAX_DAYS`, `notBeforeMs` is negative or the validity would end after
 * 9999, `commonName` is empty, longer than 64 bytes, not UTF-8 or holds a NUL
 * (it is written as a UTF8String), `priv` is not a P-256 private key, or
 * `serial` — big-endian, leading zeros ignored — is zero or
 * needs more than `X509_MAX_SERIAL` octets as a positive INTEGER (clear the top
 * bit of 20 random bytes, or use fewer).
 */
export const x509MintSelfSigned = (
  priv: u8[],
  commonName: string,
  notBeforeMs: i64,
  days: i32,
  serial: u8[]
): u8[] | null => {
  if (days < 1 || days > X509_MAX_DAYS || notBeforeMs < 0) {
    return null
  }
  const start: i64 = notBeforeMs / 1000
  const end: i64 = start + toI64(days) * 86400
  // 9999-12-31T23:59:59Z, the last second RFC 5280's times can spell.
  if (end > 253402300799) {
    return null
  }
  const name: u8[] = x509Bytes(commonName)
  const nameLength: i32 = toI32(name.length)
  if (nameLength < 1 || nameLength > X509_MAX_COMMON_NAME || !x509IsUtf8Name(name)) {
    return null
  }
  const serialDer: u8[] = x509DerUnsignedInteger(serial)
  // Tag, length, and at most twenty content octets, of which at least one is not zero.
  let nonzero: i32 = 0
  for (let k: i32 = 0; k < toI32(serial.length); k++) {
    nonzero = nonzero | toI32(serial[k])
  }
  if (nonzero === 0 || toI32(serialDer.length) - 2 > X509_MAX_SERIAL) {
    return null
  }
  const pub: u8[] | null = p256PublicKey(priv)
  if (pub === null) {
    return null
  }

  const algorithm: u8[] = x509DerWrap(X509_TAG_SEQUENCE, [x509DerTlv(X509_TAG_OID, x509OidEcdsaSha256())])
  const rdn: u8[] = x509DerWrap(X509_TAG_SET, [
    x509DerWrap(X509_TAG_SEQUENCE, [
      x509DerTlv(X509_TAG_OID, x509OidCommonName()),
      x509DerTlv(X509_TAG_UTF8_STRING, name),
    ]),
  ])
  const distinguished: u8[] = x509DerWrap(X509_TAG_SEQUENCE, [rdn])
  const spki: u8[] = x509DerWrap(X509_TAG_SEQUENCE, [
    x509DerWrap(X509_TAG_SEQUENCE, [
      x509DerTlv(X509_TAG_OID, x509OidEcPublicKey()),
      x509DerTlv(X509_TAG_OID, x509OidPrime256v1()),
    ]),
    x509DerBitString(pub),
  ])
  const tbs: u8[] = x509DerWrap(X509_TAG_SEQUENCE, [
    // [0] EXPLICIT Version: v3 is the INTEGER 2.
    x509DerWrap(0xa0, [x509DerTlv(X509_TAG_INTEGER, [2])]),
    serialDer,
    algorithm,
    distinguished,
    x509DerWrap(X509_TAG_SEQUENCE, [x509DerTimeAt(start), x509DerTimeAt(end)]),
    distinguished,
    spki,
  ])
  const rs: u8[] | null = p256SignSha256(priv, tbs)
  if (rs === null) {
    return null
  }
  const r: u8[] = x509DerSlice(rs, 0, 32)
  const s: u8[] = x509DerSlice(rs, 32, 64)
  const sig: u8[] = x509DerWrap(X509_TAG_SEQUENCE, [x509DerUnsignedInteger(r), x509DerUnsignedInteger(s)])
  return x509DerWrap(X509_TAG_SEQUENCE, [tbs, algorithm, x509DerBitString(sig)])
}

/**
 * The SHA-256 of a certificate's DER: the value WebTransport's
 * `serverCertificateHashes` pins, and what `openssl x509 -outform DER |
 * sha256sum` prints.
 */
export const x509CertificateHash = (der: u8[]): u8[] => sha256(der)

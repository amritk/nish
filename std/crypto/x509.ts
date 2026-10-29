/**
 * `nish/crypto/x509` — DER, PEM and the X.509 certificates a WebTransport or
 * TLS server holds: read a P-256 private key and a certificate chain out of
 * PEM, and mint the short-lived self-signed ECDSA P-256 certificate a browser
 * pins by its SHA-256.
 *
 *     import { x509MintSelfSigned, x509CertificateHash, derToPem } from "nish/crypto/x509";
 *     // Native only: a program that imports this does not compile for wasm32, which has no entropy.
 *     import { x509DrawP256Key, x509DrawSerial } from "nish/crypto/x509-random";
 *
 *     // Both come from the kernel's CSPRNG; a predictable key or serial is the caller's bug.
 *     // A wasm32 program is handed them instead, and passes them in as they are passed here.
 *     const priv: Secret<u8[]> = x509DrawP256Key();
 *     const der: u8[] | null = x509MintSelfSigned(priv, "localhost", toI64(Date.now()), 14, x509DrawSerial());
 *     wipe(priv);
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
 * public key and the signature — checks the order of what follows the key
 * (`[1]`, `[2]`, `[3]`), and reads the extensions path validation needs
 * (basicConstraints, keyUsage, extKeyUsage, subjectAltName, nameConstraints)
 * into fields `nish/crypto/x509-path` decides on; the mint writes two of its
 * own (below).
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
 * are the same single common name, as a UTF8String. It carries **two
 * extensions, both critical and both constant**: basicConstraints with cA
 * FALSE and keyUsage with digitalSignature alone. The W3C text requires no
 * extension, but Chromium does: the verifier behind `serverCertificateHashes`,
 * quiche's `WebTransportFingerprintProofVerifier`, parses the certificate
 * with `CertificateView::ParseSingleCertificate` before it compares the hash,
 * and that answers null when `[3] extensions` is absent
 * (`quiche/quic/core/crypto/certificate_view.cc:395`, at the quiche revision
 * 62826931 Chromium 141 pins), so the handshake fails with
 * CERTIFICATE_VERIFY_FAILED. It also holds every extension to `SEQUENCE {
 * OID, BOOLEAN OPTIONAL, OCTET STRING }` (`:413`–`:432`) and reads
 * subjectAltName only when one is present (`:434`), so no name is needed
 * there. The two chosen say what the certificate is, an end entity whose key
 * only signs handshakes, so a verifier that does build a path need not fall
 * back on its defaults; OpenSSL verifies it as its own trust anchor
 * (`tests/link/crypto_x509`'s header has the commands; X509-9 in
 * docs/security/crypto-x509.md). The key, the serial and the time are
 * parameters so the golden certificate is deterministic; a caller passes
 * `Date.now()` and, for the key and the serial, bytes from
 * `crypto.getRandomValues`. This module does not draw them itself,
 * because a call to the operating system would stop it compiling for wasm32;
 * `nish/crypto/x509-random`, which this module does not import, draws both
 * for a native program (X509-6).
 *
 * **Constant time.** A private key is the one secret that passes through here:
 * it is base64-decoded from PEM, lifted out of its DER, and handed to
 * `nish/crypto/p256`. Base64 is `nish/crypto/base64url`'s `base64StdPadDecode`,
 * which maps a character to its sextet by arithmetic on range masks and folds a
 * bad character into one word read after the whole text, so neither a branch
 * nor a table index depends on the key's bytes. PEM's framing is found by comparing
 * the start of each line with the fixed `-----BEGIN ` and `-----END `, which no
 * base64 character matches, so those comparisons end on a line's first byte
 * whatever the key is. The DER reader branches on tags and
 * lengths, which are the key's public framing, and copies its 32 octets with a
 * fixed loop. Signing is `p256SignSha256`, and checking a key against the
 * public key stored beside it compares public values. None of this is under
 * the disassembly check; it is discipline.
 *
 * **The private key is a `Secret`** (`nish:secret`, docs/LANGUAGE.md
 * "Secrets"). `x509ParseP256PrivateKey` answers one and `x509MintSelfSigned`
 * takes one; the scalar is copied out of its DER once, into the `Secret`, and
 * every block decoded from the PEM is wiped before the parse returns (X509-7,
 * docs/security/crypto-x509.md). The PEM text is the caller's string, which
 * nothing in the language can wipe.
 *
 * Private names carry the `x509` prefix because a `std/` module's private
 * functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */
import { Secret, secret, wipe } from "nish:secret"
import { base64StdPadDecode, base64StdPadEncode } from "nish/crypto/base64url"
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
const X509_TAG_BOOLEAN: i32 = 0x01
const X509_TAG_INTEGER: i32 = 0x02
const X509_TAG_BIT_STRING: i32 = 0x03
const X509_TAG_OCTET_STRING: i32 = 0x04
const X509_TAG_NULL: i32 = 0x05
const X509_TAG_OID: i32 = 0x06
const X509_TAG_UTF8_STRING: i32 = 0x0c
const X509_TAG_UTC_TIME: i32 = 0x17
const X509_TAG_GENERALIZED_TIME: i32 = 0x18
const X509_TAG_SEQUENCE: i32 = 0x30
const X509_TAG_SET: i32 = 0x31

/** `X509Certificate.keyAlgorithm`: a key this module does not name. */
export const X509_KEY_OTHER: i32 = 0
/** id-ecPublicKey on prime256v1: `publicKey` is the 65-byte uncompressed point (RFC 5480 §2.1.1). */
export const X509_KEY_P256: i32 = 1
/** id-ecPublicKey on secp384r1: `publicKey` is the 97-byte uncompressed point (RFC 5480 §2.1.1). */
export const X509_KEY_P384: i32 = 2
/** rsaEncryption with NULL parameters: `publicKey` is the RSAPublicKey DER (RFC 3279 §2.3.1). */
export const X509_KEY_RSA: i32 = 3

/** `X509Certificate.signatureAlgorithm`: an algorithm this module does not name. */
export const X509_SIG_OTHER: i32 = 0
/** ecdsa-with-SHA256, parameters absent (RFC 5758 §3.2). */
export const X509_SIG_ECDSA_SHA256: i32 = 1
/** ecdsa-with-SHA384, parameters absent (RFC 5758 §3.2). */
export const X509_SIG_ECDSA_SHA384: i32 = 2
/** sha256WithRSAEncryption, NULL parameters (RFC 4055 §5). */
export const X509_SIG_RSA_PKCS1_SHA256: i32 = 3
/** sha384WithRSAEncryption, NULL parameters (RFC 4055 §5). */
export const X509_SIG_RSA_PKCS1_SHA384: i32 = 4
/** sha512WithRSAEncryption, NULL parameters (RFC 4055 §5). */
export const X509_SIG_RSA_PKCS1_SHA512: i32 = 5
/** RSASSA-PSS with SHA-256, MGF1 with SHA-256 and a 32-byte salt (RFC 4055 §3.1). */
export const X509_SIG_RSA_PSS_SHA256: i32 = 6
/** RSASSA-PSS with SHA-384, MGF1 with SHA-384 and a 48-byte salt. */
export const X509_SIG_RSA_PSS_SHA384: i32 = 7
/** RSASSA-PSS with SHA-512, MGF1 with SHA-512 and a 64-byte salt. */
export const X509_SIG_RSA_PSS_SHA512: i32 = 8

/** keyUsage digitalSignature, named bit 0 (RFC 5280 §4.2.1.3), as `X509Certificate.keyUsage` holds it. */
export const X509_KU_DIGITAL_SIGNATURE: i32 = 1
/** keyUsage keyCertSign, named bit 5. */
export const X509_KU_KEY_CERT_SIGN: i32 = 32

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

  // The fields run widest first, so the extensions' (RFC 5280 §4.2) are spread
  // through the rest. The parser records what an extension says rather than
  // refusing it; `nish/crypto/x509-path` refuses a certificate with
  // `extensionsMalformed` or `unknownCriticalExtension` set.

  /** Each dNSName in subjectAltName, as its IA5String octets. */
  dnsNames: u8[][]
  /** Each iPAddress in subjectAltName: 4 octets for IPv4, 16 for IPv6. */
  ipAddresses: u8[][]
  /** Permitted dNSName subtrees, as IA5String octets. */
  permittedDns: u8[][]
  /** Excluded dNSName subtrees. */
  excludedDns: u8[][]
  /** Permitted iPAddress subtrees: address then mask, 8 octets for IPv4, 32 for IPv6. */
  permittedIp: u8[][]
  /** Excluded iPAddress subtrees. */
  excludedIp: u8[][]
  /** 1, 2 or 3: the version, v1 when the field is absent. */
  version: i32 = 1
  /** One of the `X509_KEY_*` constants. */
  keyAlgorithm: i32 = 0
  /** One of the `X509_SIG_*` constants: the AlgorithmIdentifier compared whole, parameters and all. */
  signatureAlgorithm: i32 = 0
  /** basicConstraints' pathLenConstraint, capped at 255, or `-1` when absent. */
  pathLenConstraint: i32 = -1
  /** keyUsage's named bits: bit `n` of this is named bit `n` (`X509_KU_*`). */
  keyUsage: i32 = 0
  /** Whether the key is id-ecPublicKey on prime256v1 (RFC 5480 §2.1.1), so `publicKey` is a P-256 point. */
  p256: boolean = false
  /** Whether the signature algorithm is ecdsa-with-SHA256 with its parameters absent (RFC 5758 §3.2). */
  ecdsaSha256: boolean = false
  /** An extension this module reads is not DER of its grammar, an OID repeats, or `critical` is spelt FALSE. */
  extensionsMalformed: boolean = false
  /** An extension marked critical is not one this module reads (§4.2: it must then be rejected). */
  unknownCriticalExtension: boolean = false
  /** basicConstraints is present (§4.2.1.9). */
  hasBasicConstraints: boolean = false
  /** basicConstraints says cA TRUE. */
  isCa: boolean = false
  /** keyUsage is present (§4.2.1.3). */
  hasKeyUsage: boolean = false
  /** extKeyUsage is present (§4.2.1.12). */
  hasExtKeyUsage: boolean = false
  /** extKeyUsage lists id-kp-serverAuth. */
  ekuServerAuth: boolean = false
  /** extKeyUsage lists anyExtendedKeyUsage. */
  ekuAny: boolean = false
  /** subjectAltName is present (§4.2.1.6). */
  hasSubjectAltName: boolean = false
  /** nameConstraints is present (§4.2.1.10). */
  hasNameConstraints: boolean = false
  /** nameConstraints names a form other than dNSName and iPAddress, which no name is checked against. */
  nameConstraintsUnsupported: boolean = false
  constructor() {
    this.der = []
    this.tbs = []
    this.serial = []
    this.issuer = []
    this.subject = []
    this.publicKey = []
    this.signature = []
    this.dnsNames = []
    this.ipAddresses = []
    this.permittedDns = []
    this.excludedDns = []
    this.permittedIp = []
    this.excludedIp = []
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

/**
 * Where the contents of the element `x509DerExpect` reads at `der[at]` start,
 * or `-1`. An index, not an element, so a loop walking a SEQUENCE with it
 * keeps nothing per pass (NL9011) when the loop also stores what it reads.
 */
const x509DerStartOf = (der: u8[], at: i32, limit: i32, tag: i32): i32 => {
  const e: X509DerElement | null = x509DerExpect(der, at, limit, tag)
  return e === null ? -1 : e.start
}

/** Where that element ends, or `-1`. */
const x509DerEndOf = (der: u8[], at: i32, limit: i32, tag: i32): i32 => {
  const e: X509DerElement | null = x509DerExpect(der, at, limit, tag)
  return e === null ? -1 : e.end
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
 * Whether `e`'s contents are a DER BIT STRING's, whatever its tag (an IMPLICIT
 * one keeps the grammar): an unused-bits count of 0 to 7, none without an
 * octet to hold them, and those bits zero (X.690 §8.6.2 and §11.2.1).
 */
const x509DerBitStringSound = (der: u8[], e: X509DerElement): boolean => {
  const n: i32 = e.end - e.start
  if (n < 1) {
    return false
  }
  const unused: i32 = toI32(der[e.start])
  if (unused > 7 || (n === 1 && unused !== 0)) {
    return false
  }
  return (toI32(der[e.end - 1]) & ((1 << unused) - 1)) === 0
}

/**
 * The octets of a BIT STRING that has no unused bits, or `null`. Keys and
 * signatures are whole octets, so the leading unused-bits count must be 0.
 */
const x509DerBitStringOctets = (der: u8[], e: X509DerElement): u8[] | null => {
  if (e.tag !== X509_TAG_BIT_STRING || !x509DerBitStringSound(der, e) || toI32(der[e.start]) !== 0) {
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
// PEM (RFC 7468), over `nish/crypto/base64url`'s padded base64
// ---------------------------------------------------------------------------

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
  const body: string = base64StdPadEncode(der)
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
      // An empty body is refused: a block with no DER is malformed, though
      // the empty text is base64 for no bytes.
      const text: string = body.join("")
      const der: u8[] | null = text.length === 0 ? null : base64StdPadDecode(text)
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
const x509Sec1Key = (der: u8[], start: i32, end: i32, needCurve: boolean): Secret<u8[]> | null => {
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
  // The scalar is copied out of the DER only once the structure is known to
  // be sound, straight into the `Secret` that owns it (X509-7). The check
  // refuses 0 and n and above, and gives the point to hold `stored` against.
  const priv: Secret<u8[]> = secret(x509DerSlice(der, key.start, key.end))
  const pub: u8[] | null = p256PublicKey(priv)
  if (pub === null || (stored !== null && !x509BytesEqual(stored, pub))) {
    wipe(priv)
    return null
  }
  return priv
}

/**
 * The scalar of a PKCS#8 PrivateKeyInfo (RFC 5208 §5) or OneAsymmetricKey
 * (RFC 5958 §2): version 0 or 1, the algorithm id-ecPublicKey with the
 * prime256v1 curve, and an ECPrivateKey inside the OCTET STRING, followed by
 * the optional `[0]` attributes, which are skipped, and — in version 1 — the
 * optional `[1]` public key, which must be a BIT STRING of the key's own point
 * (X509-8 in docs/security/crypto-x509.md).
 */
const x509Pkcs8Key = (der: u8[]): Secret<u8[]> | null => {
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
  let stored: u8[] | null = null
  if (v === 1 && x509DerPeek(der, at, seq.end) === 0x81) {
    const outer: X509DerElement | null = x509DerRead(der, at, seq.end)
    if (outer === null) {
      return null
    }
    // `[1] IMPLICIT BIT STRING`: the 0x81 replaces the BIT STRING's own tag,
    // so its contents are the unused-bits octet and then the point.
    const bits: X509DerElement = new X509DerElement(X509_TAG_BIT_STRING, outer.at, outer.start, outer.end)
    stored = x509DerBitStringOctets(der, bits)
    if (stored === null) {
      return null
    }
    at = outer.end
  }
  if (at !== seq.end) {
    return null
  }
  const priv: Secret<u8[]> | null = x509Sec1Key(der, key.start, key.end, false)
  if (priv === null || stored === null) {
    return priv
  }
  // The same rule as the SEC1 key's own `[1]`: the stored point is the key's.
  const pub: u8[] | null = p256PublicKey(priv)
  if (pub === null || !x509BytesEqual(stored, pub)) {
    wipe(priv)
    return null
  }
  return priv
}

/** Zero every block `pemToDer` decoded: a private key's DER is key material, refused or not. */
const x509WipeBlocks = (blocks: u8[][] | null): void => {
  if (blocks === null) {
    return
  }
  for (const block of blocks) {
    wipe(block)
  }
}

/**
 * The 32-byte P-256 private key in `pem`, as the `Secret` it is: one `EC
 * PRIVATE KEY` block (SEC1, RFC 5915, which must name its curve) or one
 * `PRIVATE KEY` block (unencrypted PKCS#8, RFC 5208 or RFC 5958), and not both.
 * `null` for no such block or more than one, for any curve but P-256, for a
 * scalar of 0 or n or more, for a stored public key that is not the key's own,
 * and for anything malformed. An `ENCRYPTED PRIVATE KEY` is a different label,
 * and answers `null`. Every block decoded from `pem` is wiped before this
 * returns, whichever answer it gives; `pem` itself is the caller's string,
 * which nothing can wipe (X509-7 in docs/security/crypto-x509.md).
 */
export const x509ParseP256PrivateKey = (pem: string): Secret<u8[]> | null => {
  const sec1: u8[][] | null = pemToDer(pem, "EC PRIVATE KEY")
  const pkcs8: u8[][] | null = pemToDer(pem, "PRIVATE KEY")
  let key: Secret<u8[]> | null = null
  if (sec1 !== null && pkcs8 === null && toI32(sec1.length) === 1) {
    const der: u8[] = sec1[0]
    key = x509Sec1Key(der, 0, toI32(der.length), true)
  } else if (pkcs8 !== null && sec1 === null && toI32(pkcs8.length) === 1) {
    key = x509Pkcs8Key(pkcs8[0])
  }
  // X509-7: the decoded DER holds the scalar too, whichever block it was.
  x509WipeBlocks(sec1)
  x509WipeBlocks(pkcs8)
  return key
}

// ---------------------------------------------------------------------------
// Algorithms and extensions (RFC 5280 §4.1.1.2, §4.1.2.7 and §4.2)
// ---------------------------------------------------------------------------

/** secp384r1, 1.3.132.0.34 (RFC 5480 §2.1.1.1). */
const x509OidSecp384r1 = (): u8[] => x509DerOidContents([1, 3, 132, 0, 34])

/** The PKCS #1 arc 1.2.840.113549.1.1.`last` (RFC 4055 §2.1 and §5). */
const x509OidPkcs1 = (last: i32): u8[] => x509DerOidContents([1, 2, 840, 113549, 1, 1, last])

/** The NIST hash arc 2.16.840.1.101.3.4.2.`last`: 1 SHA-256, 2 SHA-384, 3 SHA-512. */
const x509OidNistHash = (last: i32): u8[] => x509DerOidContents([2, 16, 840, 1, 101, 3, 4, 2, last])

/** The certificate extension arc 2.5.29.`last` (RFC 5280 §4.2.1). */
const x509OidCe = (last: i32): u8[] => x509DerOidContents([2, 5, 29, last])

/** An AlgorithmIdentifier, whole: `SEQUENCE { oid, params... }`. */
const x509DerAlgorithm = (oid: u8[], params: u8[][]): u8[] => {
  const parts: u8[][] = [x509DerTlv(X509_TAG_OID, oid)]
  for (const p of params) {
    parts.push(p)
  }
  return x509DerWrap(X509_TAG_SEQUENCE, parts)
}

/**
 * RSASSA-PSS's AlgorithmIdentifier for hash `h` (1 to 3, `x509OidNistHash`'s
 * arc) whose digest is `bytes` long: the hash, MGF1 over the same hash, a salt
 * as long as the digest and the trailer left at its DEFAULT (RFC 4055 §3.1,
 * and RFC 8446 §4.2.3's profile). `nullParams` spells the hash
 * AlgorithmIdentifiers with NULL parameters, as OpenSSL writes them; without,
 * absent, which RFC 4055 §2.1 also allows.
 */
const x509PssAlgorithm = (h: i32, bytes: i32, nullParams: boolean): u8[] => {
  const params0: u8[][] = nullParams ? [x509DerTlv(X509_TAG_NULL, [])] : []
  const hash: u8[] = x509DerAlgorithm(x509OidNistHash(h), params0)
  const params: u8[] = x509DerWrap(X509_TAG_SEQUENCE, [
    x509DerWrap(0xa0, [hash]),
    x509DerWrap(0xa1, [x509DerAlgorithm(x509OidPkcs1(8), [hash])]),
    x509DerWrap(0xa2, [x509DerTlv(X509_TAG_INTEGER, [toU8(bytes)])]),
  ])
  return x509DerAlgorithm(x509OidPkcs1(10), [params])
}

/**
 * Whether the AlgorithmIdentifier `alg` is `X509_SIG_*` `code`'s single DER
 * spelling (either of two for PSS). A boolean, so the loop asking it of each
 * code keeps none of the spellings it builds.
 */
const x509SignatureIs = (alg: u8[], code: i32): boolean => {
  if (code <= X509_SIG_ECDSA_SHA384) {
    const oid: u8[] = x509DerOidContents([1, 2, 840, 10045, 4, 3, code + 1])
    return x509BytesEqual(alg, x509DerAlgorithm(oid, []))
  }
  if (code <= X509_SIG_RSA_PKCS1_SHA512) {
    const k: i32 = code - X509_SIG_RSA_PKCS1_SHA256
    return x509BytesEqual(alg, x509DerAlgorithm(x509OidPkcs1(11 + k), [x509DerTlv(X509_TAG_NULL, [])]))
  }
  const k: i32 = code - X509_SIG_RSA_PSS_SHA256
  const bytes: i32 = k * 16 + 32
  return x509BytesEqual(alg, x509PssAlgorithm(k + 1, bytes, true)) || x509BytesEqual(alg, x509PssAlgorithm(k + 1, bytes, false))
}

/**
 * Which `X509_SIG_*` the AlgorithmIdentifier `alg` is, compared whole against
 * each one's DER spelling, so a parameter this module does not expect makes it
 * `X509_SIG_OTHER` rather than something read past.
 */
const x509SignatureAlgorithm = (alg: u8[]): i32 => {
  for (let code: i32 = X509_SIG_ECDSA_SHA256; code <= X509_SIG_RSA_PSS_SHA512; code++) {
    if (x509SignatureIs(alg, code)) {
      return code
    }
  }
  return X509_SIG_OTHER
}

/** Which `X509_KEY_*` the SubjectPublicKeyInfo's AlgorithmIdentifier `alg` names. */
const x509KeyAlgorithm = (der: u8[], alg: X509DerElement): i32 => {
  if (x509DerIsAlgorithm(der, alg, x509OidEcPublicKey(), x509OidPrime256v1())) {
    return X509_KEY_P256
  }
  if (x509DerIsAlgorithm(der, alg, x509OidEcPublicKey(), x509OidSecp384r1())) {
    return X509_KEY_P384
  }
  const rsa: u8[] = x509DerAlgorithm(x509OidPkcs1(1), [x509DerTlv(X509_TAG_NULL, [])])
  return x509BytesEqual(x509DerWhole(der, alg), rsa) ? X509_KEY_RSA : X509_KEY_OTHER
}

/**
 * Each element directly inside `der[start .. end)`, or `null` unless they fill
 * it exactly and there is at least one: a `SEQUENCE SIZE (1..MAX) OF`'s items.
 */
const x509DerItems = (der: u8[], start: i32, end: i32): X509DerElement[] | null => {
  const out: X509DerElement[] = []
  let at: i32 = start
  while (at < end) {
    const e: X509DerElement | null = x509DerRead(der, at, end)
    if (e === null) {
      return null
    }
    out.push(e)
    at = e.end
  }
  return toI32(out.length) === 0 ? null : out
}

/**
 * The one element filling `der[start .. end)` with tag `tag`, or `null`: what
 * an extension's OCTET STRING must hold.
 */
const x509DerOnly = (der: u8[], start: i32, end: i32, tag: i32): X509DerElement | null => {
  const e: X509DerElement | null = x509DerExpect(der, start, end, tag)
  return e !== null && e.end === end ? e : null
}

/**
 * basicConstraints' `SEQUENCE { cA BOOLEAN DEFAULT FALSE, pathLenConstraint
 * INTEGER (0..MAX) OPTIONAL }` into `out`, or `false` unless it is DER: cA
 * present only as TRUE (X.690 §11.5 drops a DEFAULT), a minimal non-negative
 * pathLen, and pathLen only beside cA (§4.2.1.9).
 */
const x509ReadBasicConstraints = (der: u8[], seq: X509DerElement, out: X509Certificate): boolean => {
  let at: i32 = seq.start
  if (x509DerPeek(der, at, seq.end) === X509_TAG_BOOLEAN) {
    const ca: X509DerElement | null = x509DerRead(der, at, seq.end)
    if (ca === null || ca.end - ca.start !== 1 || toI32(der[ca.start]) !== 0xff) {
      return false
    }
    out.isCa = true
    at = ca.end
  }
  if (at < seq.end) {
    const len: X509DerElement | null = x509DerOnly(der, at, seq.end, X509_TAG_INTEGER)
    if (len === null || !out.isCa || !x509DerIntegerMinimal(der, len) || toI32(der[len.start]) >= 0x80) {
      return false
    }
    const total: i32 = toI32(der.length)
    let value: i32 = 0
    for (let k: i32 = len.start; k >= 0 && k < len.end && k < total; k++) {
      value = value > 255 ? 256 : (value << 8) | toI32(der[k])
    }
    out.pathLenConstraint = value > 255 ? 255 : value
  }
  out.hasBasicConstraints = true
  return true
}

/**
 * keyUsage's named BIT STRING into `out.keyUsage`, or `false` unless it is a
 * sound BIT STRING with at least one bit set (§4.2.1.3). Bits past
 * decipherOnly (8) are read and ignored.
 */
const x509ReadKeyUsage = (der: u8[], bits: X509DerElement, out: X509Certificate): boolean => {
  if (bits.tag !== X509_TAG_BIT_STRING || !x509DerBitStringSound(der, bits)) {
    return false
  }
  let usage: i32 = 0
  let any: boolean = false
  const total: i32 = toI32(der.length)
  for (let k: i32 = bits.start + 1; k >= 0 && k < bits.end && k < total; k++) {
    const octet: i32 = toI32(der[k])
    any = any || octet !== 0
    let bit: i32 = (k - bits.start - 1) * 8
    for (let mask: i32 = 0x80; mask > 0 && bit < 9; mask = mask >> 1) {
      if ((octet & mask) !== 0) {
        usage = usage | (X509_KU_DIGITAL_SIGNATURE << bit)
      }
      bit = bit + 1
    }
  }
  out.hasKeyUsage = true
  out.keyUsage = usage
  return any
}

/** extKeyUsage's `SEQUENCE SIZE (1..MAX) OF KeyPurposeId` into `out`, or `false` unless it is one. */
const x509ReadExtKeyUsage = (der: u8[], seq: X509DerElement, out: X509Certificate): boolean => {
  const items: X509DerElement[] | null = x509DerItems(der, seq.start, seq.end)
  if (items === null) {
    return false
  }
  const serverAuth: u8[] = x509DerOidContents([1, 3, 6, 1, 5, 5, 7, 3, 1])
  const anyPurpose: u8[] = x509DerOidContents([2, 5, 29, 37, 0])
  for (const item of items) {
    if (item.tag !== X509_TAG_OID || item.end === item.start) {
      return false
    }
    out.ekuServerAuth = out.ekuServerAuth || x509DerContentsAre(der, item, serverAuth)
    out.ekuAny = out.ekuAny || x509DerContentsAre(der, item, anyPurpose)
  }
  out.hasExtKeyUsage = true
  return true
}

/**
 * subjectAltName's `SEQUENCE SIZE (1..MAX) OF GeneralName` into `out`, or
 * `false` unless it is one: a dNSName (`[2]`) is kept as its octets, an
 * iPAddress (`[7]`) must be 4 or 16 octets and is kept, and the other forms
 * need only be well-formed elements.
 */
const x509ReadSubjectAltName = (der: u8[], seq: X509DerElement, out: X509Certificate): boolean => {
  const items: X509DerElement[] | null = x509DerItems(der, seq.start, seq.end)
  if (items === null) {
    return false
  }
  for (const item of items) {
    const n: i32 = item.end - item.start
    if (item.tag === 0x82) {
      out.dnsNames.push(x509DerSlice(der, item.start, item.end))
    } else if (item.tag === 0x87) {
      if (n !== 4 && n !== 16) {
        return false
      }
      out.ipAddresses.push(x509DerSlice(der, item.start, item.end))
    }
  }
  out.hasSubjectAltName = true
  return true
}

/**
 * One `GeneralSubtrees` (`[0]` permitted or `[1]` excluded) into `dns` and
 * `ip`, or `false` unless each subtree is `SEQUENCE { base }` with minimum and
 * maximum absent (§4.2.1.10: minimum MUST be zero, which DER omits, and
 * maximum MUST be absent) and an iPAddress base is 8 or 32 octets. A base of
 * any other form sets `nameConstraintsUnsupported`.
 */
const x509ReadSubtrees = (der: u8[], trees: X509DerElement, dns: u8[][], ip: u8[][], out: X509Certificate): boolean => {
  const items: X509DerElement[] | null = x509DerItems(der, trees.start, trees.end)
  if (items === null) {
    return false
  }
  for (const item of items) {
    if (item.tag !== X509_TAG_SEQUENCE) {
      return false
    }
    const tag: i32 = x509DerPeek(der, item.start, item.end)
    const start: i32 = x509DerStartOf(der, item.start, item.end, tag)
    if (start < 0 || x509DerEndOf(der, item.start, item.end, tag) !== item.end) {
      return false
    }
    const n: i32 = item.end - start
    if (tag === 0x82) {
      dns.push(x509DerSlice(der, start, item.end))
    } else if (tag === 0x87) {
      if (n !== 8 && n !== 32) {
        return false
      }
      ip.push(x509DerSlice(der, start, item.end))
    } else {
      out.nameConstraintsUnsupported = true
    }
  }
  return true
}

/**
 * nameConstraints' `SEQUENCE { permittedSubtrees [0] OPTIONAL,
 * excludedSubtrees [1] OPTIONAL }` into `out`, or `false` unless it is one
 * with at least one of the two (§4.2.1.10: an empty sequence MUST NOT be).
 */
const x509ReadNameConstraints = (der: u8[], seq: X509DerElement, out: X509Certificate): boolean => {
  if (seq.end === seq.start) {
    return false
  }
  let at: i32 = seq.start
  if (x509DerPeek(der, at, seq.end) === 0xa0) {
    const permitted: X509DerElement | null = x509DerRead(der, at, seq.end)
    if (permitted === null || !x509ReadSubtrees(der, permitted, out.permittedDns, out.permittedIp, out)) {
      return false
    }
    at = permitted.end
  }
  if (at < seq.end) {
    const excluded: X509DerElement | null = x509DerOnly(der, at, seq.end, 0xa1)
    if (excluded === null || !x509ReadSubtrees(der, excluded, out.excludedDns, out.excludedIp, out)) {
      return false
    }
  }
  out.hasNameConstraints = true
  return true
}

/** Where the extnValue OCTET STRING's contents start in the `Extension` at `der[at .. end)`, or `-1`. */
const x509ExtensionValueStart = (der: u8[], at: i32, end: i32): i32 => {
  const ext: X509DerElement | null = x509DerExpect(der, at, end, X509_TAG_SEQUENCE)
  if (ext === null) {
    return -1
  }
  let next: i32 = x509DerEndOf(der, ext.start, ext.end, X509_TAG_OID)
  if (x509DerPeek(der, next, ext.end) === X509_TAG_BOOLEAN) {
    next = x509DerEndOf(der, next, ext.end, X509_TAG_BOOLEAN)
  }
  const value: X509DerElement | null = x509DerOnly(der, next, ext.end, X509_TAG_OCTET_STRING)
  return value === null || value.end !== end ? -1 : value.start
}

/**
 * The value of the known `Extension` at `der[at .. end)`, which
 * `x509ExtensionKind` has read as `which` (`x509OidCe`'s last arc), into `out`,
 * or `false` unless the element inside its OCTET STRING is DER of that
 * extension's grammar. The OCTET STRING is the Extension's last element, so
 * its contents end where the Extension does.
 */
const x509ReadExtension = (der: u8[], which: i32, at: i32, end: i32, out: X509Certificate): boolean => {
  const start: i32 = x509ExtensionValueStart(der, at, end)
  if (start < 0) {
    return false
  }
  if (which === 15) {
    const bits: X509DerElement | null = x509DerOnly(der, start, end, X509_TAG_BIT_STRING)
    return bits !== null && x509ReadKeyUsage(der, bits, out)
  }
  const seq: X509DerElement | null = x509DerOnly(der, start, end, X509_TAG_SEQUENCE)
  if (seq === null) {
    return false
  }
  if (which === 19) {
    return x509ReadBasicConstraints(der, seq, out)
  }
  if (which === 37) {
    return x509ReadExtKeyUsage(der, seq, out)
  }
  if (which === 17) {
    return x509ReadSubjectAltName(der, seq, out)
  }
  return x509ReadNameConstraints(der, seq, out)
}

/**
 * Whether a `[3]` extensions wrapper holds one non-empty SEQUENCE and nothing
 * after it (RFC 5280 §4.1's `SIZE (1..MAX)`); what the extensions say goes
 * into `out` (`x509ReadExtensions`).
 */
const x509DerExtensionsSound = (der: u8[], e: X509DerElement): boolean => {
  const seq: X509DerElement | null = x509DerExpect(der, e.start, e.end, X509_TAG_SEQUENCE)
  return seq !== null && seq.end === e.end && seq.end > seq.start
}

/** What `x509ExtensionKind` answers for an extension this module does not read. */
const X509_EXT_UNKNOWN: i32 = -1
/** The same, for one marked critical. */
const X509_EXT_UNKNOWN_CRITICAL: i32 = -2
/** The same, for one that is not `Extension`'s shape or repeats an extnID. */
const X509_EXT_MALFORMED: i32 = -3

/**
 * Whether an extension in `der[first .. before)`, the ones ahead of this one,
 * has the extnID `der[idStart .. idEnd)` (§4.2: at most one of each).
 */
const x509ExtensionSeen = (der: u8[], first: i32, before: i32, idStart: i32, idEnd: i32): boolean => {
  let at: i32 = first
  while (at < before) {
    const ext: X509DerElement | null = x509DerExpect(der, at, before, X509_TAG_SEQUENCE)
    if (ext === null) {
      return false
    }
    const id: X509DerElement | null = x509DerExpect(der, ext.start, ext.end, X509_TAG_OID)
    if (id !== null && id.end - id.start === idEnd - idStart) {
      const total: i32 = toI32(der.length)
      let same: boolean = true
      for (let k: i32 = 0; k < id.end - id.start; k++) {
        const i: i32 = id.start + k
        const j: i32 = idStart + k
        if (i >= 0 && i < total && j >= 0 && j < total && der[i] !== der[j]) {
          same = false
        }
      }
      if (same) {
        return true
      }
    }
    at = ext.end
  }
  return false
}

/**
 * The `Extension` at `der[at]`, inside the extensions SEQUENCE whose first
 * extension is at `first` and which ends at `limit`: `SEQUENCE { extnID OID,
 * critical BOOLEAN DEFAULT FALSE, extnValue OCTET STRING }`. Answers the extnID's
 * last arc under 2.5.29 for one this module reads, else an `X509_EXT_*`: a
 * critical flag spelt FALSE (DER omits a DEFAULT) or an extnID seen before is
 * malformed. Allocates nothing that outlives it, so the walk calling it per
 * extension keeps nothing per pass.
 */
const x509ExtensionKind = (der: u8[], first: i32, at: i32, limit: i32): i32 => {
  const ext: X509DerElement | null = x509DerExpect(der, at, limit, X509_TAG_SEQUENCE)
  if (ext === null) {
    return X509_EXT_MALFORMED
  }
  const id: X509DerElement | null = x509DerExpect(der, ext.start, ext.end, X509_TAG_OID)
  if (id === null || id.end === id.start || x509ExtensionSeen(der, first, at, id.start, id.end)) {
    return X509_EXT_MALFORMED
  }
  let next: i32 = id.end
  let critical: boolean = false
  if (x509DerPeek(der, next, ext.end) === X509_TAG_BOOLEAN) {
    const flag: X509DerElement | null = x509DerRead(der, next, ext.end)
    if (flag === null || flag.end - flag.start !== 1 || toI32(der[flag.start]) !== 0xff) {
      return X509_EXT_MALFORMED
    }
    critical = true
    next = flag.end
  }
  if (x509DerOnly(der, next, ext.end, X509_TAG_OCTET_STRING) === null) {
    return X509_EXT_MALFORMED
  }
  const oid: u8[] = x509DerSlice(der, id.start, id.end)
  const known: i32[] = [19, 15, 37, 17, 30]
  for (const k of known) {
    if (x509BytesEqual(oid, x509OidCe(k))) {
      return k
    }
  }
  return critical ? X509_EXT_UNKNOWN_CRITICAL : X509_EXT_UNKNOWN
}

/**
 * The `Extensions` inside the sound `[3]` wrapper `e`, read into `out`:
 * basicConstraints, keyUsage, extKeyUsage, subjectAltName and nameConstraints
 * are read, any other is skipped unless it is critical, which sets
 * `unknownCriticalExtension`. An extension `x509ExtensionKind` calls malformed,
 * or a known one whose value is not its grammar, sets `extensionsMalformed`
 * and stops the reading; it does not refuse the certificate, which stays a
 * parse a caller can look at.
 */
const x509ReadExtensions = (der: u8[], e: X509DerElement, out: X509Certificate): void => {
  const seq: X509DerElement | null = x509DerExpect(der, e.start, e.end, X509_TAG_SEQUENCE)
  if (seq === null) {
    return
  }
  let at: i32 = seq.start
  while (at < seq.end) {
    const end: i32 = x509DerEndOf(der, at, seq.end, X509_TAG_SEQUENCE)
    const which: i32 = x509ExtensionKind(der, seq.start, at, seq.end)
    if (end < 0 || which === X509_EXT_MALFORMED) {
      out.extensionsMalformed = true
      return
    }
    if (which === X509_EXT_UNKNOWN_CRITICAL) {
      out.unknownCriticalExtension = true
    } else if (which > 0 && !x509ReadExtension(der, which, at, end, out)) {
      out.extensionsMalformed = true
      return
    }
    at = end
  }
}

// ---------------------------------------------------------------------------
// Certificates (RFC 5280 §4.1)
// ---------------------------------------------------------------------------

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
 * clock. It reads basicConstraints, keyUsage, extKeyUsage, subjectAltName
 * and nameConstraints into their fields, and records a malformed extension or
 * an unknown critical one rather than refusing the certificate:
 * `nish/crypto/x509-path`'s `x509ValidatePath` is what honours them.
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
  // Each is held to its outer shape; the extensions are read after (x509ReadExtensions).
  const trailing: i32[] = [0x81, 0x82, 0xa3]
  let extensions: X509DerElement | null = null
  for (let i: i32 = 0; i < 3; i++) {
    if (x509DerPeek(der, at, tbs.end) === trailing[i]) {
      const e: X509DerElement | null = x509DerRead(der, at, tbs.end)
      if (e === null || version < (i === 2 ? 2 : 1)) {
        return null
      }
      if (i === 2 ? !x509DerExtensionsSound(der, e) : !x509DerBitStringSound(der, e)) {
        return null
      }
      if (i === 2) {
        extensions = e
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
  out.version = version + 1
  out.keyAlgorithm = x509KeyAlgorithm(der, keyAlg)
  out.signatureAlgorithm = x509SignatureAlgorithm(x509DerWhole(der, outerAlg))
  if (extensions !== null) {
    x509ReadExtensions(der, extensions, out)
  }
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
 * whether `issuer` may issue at all (basicConstraints, keyUsage) is
 * `x509ValidatePath`'s to decide (`nish/crypto/x509-path`), so a `true` here
 * is not path validation.
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
 * The minted certificate's `[3] extensions`, whole, in DER. They do not depend
 * on the key, the name or the time, so they are one constant block rather
 * than a tree of `x509DerWrap` calls (`tests/link/crypto_x509` pins each
 * octet, and `x509ParseCertificate` reads the result back):
 *
 *     a3 20                      [3] EXPLICIT, 32 octets
 *       30 1e                    Extensions SEQUENCE, 30 octets
 *         30 0c                  Extension (RFC 5280 §4.2.1.9)
 *           06 03 55 1d 13       basicConstraints, 2.5.29.19
 *           01 01 ff             critical TRUE
 *           04 02 30 00          OCTET STRING { SEQUENCE {} }: cA FALSE is the
 *                                DEFAULT, so DER leaves it out (X.690 §11.5)
 *         30 0e                  Extension (RFC 5280 §4.2.1.3)
 *           06 03 55 1d 0f       keyUsage, 2.5.29.15
 *           01 01 ff             critical TRUE
 *           04 04 03 02 07 80    OCTET STRING { BIT STRING, 7 unused bits,
 *                                bit 0 digitalSignature }: DER drops a named
 *                                bit list's trailing zero bits (X.690 §11.2.2)
 */
const x509MintExtensions = (): u8[] => [
  0xa3, 0x20, 0x30, 0x1e, 0x30, 0x0c, 0x06, 0x03, 0x55, 0x1d, 0x13, 0x01, 0x01, 0xff, 0x04, 0x02, 0x30, 0x00,
  0x30, 0x0e, 0x06, 0x03, 0x55, 0x1d, 0x0f, 0x01, 0x01, 0xff, 0x04, 0x04, 0x03, 0x02, 0x07, 0x80,
]

/**
 * A self-signed X.509 v3 certificate, in DER, for the P-256 key `priv`: subject
 * and issuer `CN=commonName`, valid from `notBeforeMs` (milliseconds since
 * 1970, rounded down to the second) for exactly `days` days, serial number
 * `serial`, carrying `x509MintExtensions`' basicConstraints and keyUsage, and
 * signed with ecdsa-with-SHA256 — see the module comment for why Chromium
 * needs an extension at all. `null` when `days` is below 1 or above
 * `X509_MAX_DAYS`, `notBeforeMs` is negative or the validity would end after
 * 9999, `commonName` is empty, longer than 64 bytes, not UTF-8 or holds a NUL
 * (it is written as a UTF8String), `priv` is not a P-256 private key, or
 * `serial` — big-endian, leading zeros ignored — is zero or
 * needs more than `X509_MAX_SERIAL` octets as a positive INTEGER (clear the top
 * bit of 20 random bytes, or use fewer).
 */
export const x509MintSelfSigned = (
  priv: Secret<u8[]>,
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
    x509MintExtensions(),
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

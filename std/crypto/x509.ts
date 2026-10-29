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
 * profile and its extensions), RFC 7468 (PEM's textual encoding), RFC 5915 and
 * RFC 5208/5958 (the SEC1 and PKCS#8 private-key structures), RFC 5480 (the
 * elliptic-curve key identifiers), RFC 5758 (ECDSA with SHA-2), RFC 4055 (RSA
 * PKCS#1 v1.5 and RSASSA-PSS identifiers) and RFC 8410 (Ed25519).
 *
 * **DER is read strictly.** X.690 §10 leaves one encoding per value, and a
 * reader that accepts a second spelling gives a certificate two identities
 * while its hash — which is what a browser pins — names only one. So a length
 * must be definite and minimal (no `0x80`, no long form below 128, no leading
 * zero length octet), an INTEGER must be minimal in two's complement, a tag
 * must fit in one octet, every element must end inside its parent, and a
 * certificate must end where its outer SEQUENCE does. Anything else answers
 * `null`, never a panic. The reader takes the version, serial, algorithms,
 * the issuer and subject Names (their RDNs checked, their bytes kept whole),
 * validity, the subject public key and the signature, checks the order of what
 * follows the key (`[1]`, `[2]`, `[3]`), and decodes the extensions a path
 * validator needs: subjectAltName, basicConstraints, keyUsage, extKeyUsage,
 * nameConstraints and the two key identifiers. A duplicate or malformed one
 * refuses the certificate, and any other critical one sets `unknownCritical`.
 * It parses and does not validate: no module in `std/` does RFC 5280 §6 path
 * validation yet, so applying these is the caller's. The mint writes two extensions of its
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

/** `X509Certificate.sigAlg`: a signature algorithm this module does not name, or one with parameters it does not accept. */
export const X509_SIG_UNKNOWN: i32 = 0
/** ecdsa-with-SHA256, parameters absent (RFC 5758 §3.2). */
export const X509_SIG_ECDSA_SHA256: i32 = 1
/** ecdsa-with-SHA384, parameters absent (RFC 5758 §3.2). */
export const X509_SIG_ECDSA_SHA384: i32 = 2
/** sha256WithRSAEncryption, parameters NULL (RFC 4055 §5). */
export const X509_SIG_RSA_PKCS1_SHA256: i32 = 3
/** sha384WithRSAEncryption, parameters NULL. */
export const X509_SIG_RSA_PKCS1_SHA384: i32 = 4
/** sha512WithRSAEncryption, parameters NULL. */
export const X509_SIG_RSA_PKCS1_SHA512: i32 = 5
/**
 * RSASSA-PSS (RFC 4055 §3.1) with a SHA-2 hash, MGF1 over that same hash and
 * the trailer 1; the hash is in `pssHash` and the salt length in `pssSaltLen`.
 */
export const X509_SIG_RSA_PSS: i32 = 6
/** Ed25519, parameters absent (RFC 8410 §3). */
export const X509_SIG_ED25519: i32 = 7
/** sha1WithRSAEncryption, parameters NULL: recognised so that a verifier can refuse it by name. */
export const X509_SIG_RSA_PKCS1_SHA1: i32 = 8

/** `X509Certificate.keyType`: a key algorithm this module does not name. */
export const X509_KEY_UNKNOWN: i32 = 0
/** id-ecPublicKey on secp256r1 (RFC 5480 §2.1.1): the same test as `p256`. */
export const X509_KEY_P256: i32 = 1
/** id-ecPublicKey on secp384r1 (RFC 5480 §2.1.1.1). */
export const X509_KEY_P384: i32 = 2
/** rsaEncryption with NULL parameters (RFC 3279 §2.3.1); `publicKey` is the RSAPublicKey DER. */
export const X509_KEY_RSA: i32 = 3
/** id-Ed25519 with parameters absent (RFC 8410 §3). */
export const X509_KEY_ED25519: i32 = 4

/** `X509Certificate.pssHash`: SHA-256. */
export const X509_HASH_SHA256: i32 = 1
/** SHA-384. */
export const X509_HASH_SHA384: i32 = 2
/** SHA-512. */
export const X509_HASH_SHA512: i32 = 3

/** `X509GeneralSubtree.kind`: a dNSName, in `dns`. */
export const X509_GN_DNS: i32 = 1
/** An iPAddress range, `ip` under `mask`. */
export const X509_GN_IP: i32 = 2
/** A directoryName, the Name's DER in `dirName`. */
export const X509_GN_DIR: i32 = 3
/** Any other GeneralName form: rfc822Name, URI, otherName and the rest, which this module keeps no value for. */
export const X509_GN_OTHER: i32 = 4

/** `X509Certificate.keyUsage` bits (RFC 5280 §4.2.1.3): bit 0 is digitalSignature. */
export const X509_KU_DIGITAL_SIGNATURE: i32 = 1
/** keyCertSign, bit 5. */
export const X509_KU_KEY_CERT_SIGN: i32 = 32
/** cRLSign, bit 6. */
export const X509_KU_CRL_SIGN: i32 = 64

/** The longest common name minted, in bytes (RFC 5280 Appendix A's `ub-common-name`). */
const X509_MAX_COMMON_NAME: i32 = 64

/**
 * The most extensions a certificate may carry. A Web PKI certificate carries
 * fewer than 20; the cap bounds the repeated-extnID search, which compares
 * each extension with every one before it.
 */
const X509_MAX_EXTENSIONS: i32 = 64

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

/**
 * One subtree of a nameConstraints extension (RFC 5280 §4.2.1.10): its base
 * name's form in `kind`, and the value of the forms this module reads. A
 * subtree whose `minimum` or `maximum` is present keeps its base here and sets
 * the certificate's `ncUnsupported`.
 */
export class X509GeneralSubtree {
  /** `X509_GN_DNS`, `X509_GN_IP`, `X509_GN_DIR` or `X509_GN_OTHER`. */
  kind: i32 = 0
  /** For a dNSName, its IA5 bytes exactly as encoded, with no case folded; `""` may be the whole tree. */
  dns: string = ""
  /** For an iPAddress, the address: 4 octets or 16. */
  ip: u8[]
  /** For an iPAddress, the mask, as long as `ip` and contiguous. */
  mask: u8[]
  /** For a directoryName, the Name's DER, whole. */
  dirName: u8[]

  constructor() {
    this.ip = []
    this.mask = []
    this.dirName = []
  }
}

/**
 * One certificate, as `x509ParseCertificate` and `x509ParseChain` read it.
 * The byte fields are copies, so the certificate outlives the text it was read
 * from. Times are milliseconds since 1970-01-01 UTC, as `Date.now()` counts.
 */
export class X509Certificate {
  // Widest first, which leaves no padding: pointers and i64s, then i32s, then booleans.
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
  /** subjectAltName's dNSNames, the IA5 bytes exactly as encoded, with no case folded. */
  sanDns: string[]
  /** subjectAltName's iPAddresses, 4 octets or 16 each. */
  sanIp: u8[][]
  /** nameConstraints' permittedSubtrees, in order. */
  ncPermitted: X509GeneralSubtree[]
  /** nameConstraints' excludedSubtrees, in order. */
  ncExcluded: X509GeneralSubtree[]
  /** The subjectKeyIdentifier (RFC 5280 §4.2.1.2), or `null`. */
  skid: u8[] | null = null
  /** The authorityKeyIdentifier's keyIdentifier (RFC 5280 §4.2.1.1), or `null`. */
  akid: u8[] | null = null
  /** The version as encoded: 0 for v1, 1 for v2, 2 for v3. */
  version: i32 = 0
  /** The signature algorithm, an `X509_SIG_` constant. */
  sigAlg: i32 = 0
  /** For RSASSA-PSS, the hash of the message and of MGF1, an `X509_HASH_` constant; else 0. */
  pssHash: i32 = 0
  /** For RSASSA-PSS, the salt length in octets; else 0. */
  pssSaltLen: i32 = 0
  /** The subject key's algorithm, an `X509_KEY_` constant. */
  keyType: i32 = 0
  /**
   * How many of subjectAltName's names are another form: rfc822Name, URI,
   * directoryName and the rest. Each must still be well formed: an rfc822Name
   * or URI is an IA5String like a dNSName, so one with an octet of 0x80 or
   * more, or a NUL, refuses the certificate rather than being counted.
   */
  sanOther: i32 = 0
  /** basicConstraints' pathLenConstraint, or -1 when it is absent (no limit) or the extension is. */
  bcPathLen: i32 = -1
  /** The keyUsage bits (RFC 5280 §4.2.1.3), bit 0 digitalSignature to bit 8 decipherOnly, or -1 when absent. */
  keyUsage: i32 = -1
  /** Whether the key is id-ecPublicKey on prime256v1 (RFC 5480 §2.1.1), so `publicKey` is a P-256 point. */
  p256: boolean = false
  /** Whether the signature algorithm is ecdsa-with-SHA256 with its parameters absent (RFC 5758 §3.2). */
  ecdsaSha256: boolean = false
  /** Whether a subjectAltName extension is present (RFC 5280 §4.2.1.6). */
  sanPresent: boolean = false
  /** Whether a basicConstraints extension is present (RFC 5280 §4.2.1.9). */
  bcPresent: boolean = false
  /** basicConstraints' cA flag. */
  bcCa: boolean = false
  /** Whether an extKeyUsage extension is present (RFC 5280 §4.2.1.12). */
  ekuPresent: boolean = false
  /** Whether extKeyUsage names id-kp-serverAuth. */
  ekuServerAuth: boolean = false
  /** Whether extKeyUsage names anyExtendedKeyUsage. */
  ekuAny: boolean = false
  /** Whether a nameConstraints extension is present (RFC 5280 §4.2.1.10). */
  ncPresent: boolean = false
  /** Whether any subtree is `X509_GN_OTHER` or carries a `minimum` or `maximum`, which a validator must refuse or understand. */
  ncUnsupported: boolean = false
  /** Whether a critical extension is one this module does not decode: RFC 5280 §4.2 has a verifier refuse it. */
  unknownCritical: boolean = false

  constructor() {
    this.der = []
    this.tbs = []
    this.serial = []
    this.issuer = []
    this.subject = []
    this.publicKey = []
    this.signature = []
    this.sanDns = []
    this.sanIp = []
    this.ncPermitted = []
    this.ncExcluded = []
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
  const e = new X509DerElement(0, 0, 0, 0)
  if (!x509DerReadInto(der, at, limit, e)) {
    return null
  }
  return e
}

/**
 * `x509DerRead` into `into`, answering whether it read one: what a loop uses
 * so a pass allocates nothing it leaves behind. `into` is unspecified on `false`.
 */
const x509DerReadInto = (der: u8[], at: i32, limit: i32, into: X509DerElement): boolean => {
  if (at < 0 || limit > toI32(der.length) || at > limit - 2) {
    return false
  }
  const tag: i32 = toI32(der[at])
  if ((tag & 0x1f) === 0x1f) {
    return false
  }
  let length: i32 = toI32(der[at + 1])
  let start: i32 = at + 2
  if (length >= 0x80) {
    const count: i32 = length & 0x7f
    // 0x80 alone is BER's indefinite length, which DER forbids.
    if (count < 1 || count > 4 || count > limit - start) {
      return false
    }
    if (toI32(der[start]) === 0 || (count === 4 && toI32(der[start]) >= 0x80)) {
      return false
    }
    length = 0
    for (let k: i32 = 0; k < count; k++) {
      length = (length << 8) | toI32(der[start + k])
    }
    if (length < 0x80) {
      return false
    }
    start = start + count
  }
  if (length > limit - start) {
    return false
  }
  into.tag = tag
  into.at = at
  into.start = start
  into.end = start + length
  return true
}

/** `x509DerRead`, answering `null` also when the element's tag is not `tag`. */
const x509DerExpect = (der: u8[], at: i32, limit: i32, tag: i32): X509DerElement | null => {
  const e: X509DerElement | null = x509DerRead(der, at, limit)
  if (e === null || e.tag !== tag) {
    return null
  }
  return e
}

/** `x509DerReadInto`, answering `false` also when the element's tag is not `tag`. */
const x509DerExpectInto = (der: u8[], at: i32, limit: i32, tag: i32, into: X509DerElement): boolean =>
  x509DerReadInto(der, at, limit, into) && into.tag === tag

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

/** ecdsa-with-SHA384, 1.2.840.10045.4.3.3 (RFC 5758 §3.2). */
const x509OidEcdsaSha384 = (): u8[] => x509DerOidContents([1, 2, 840, 10045, 4, 3, 3])

/** secp384r1, 1.3.132.0.34 (RFC 5480 §2.1.1.1). */
const x509OidSecp384r1 = (): u8[] => x509DerOidContents([1, 3, 132, 0, 34])

/** The PKCS #1 arc 1.2.840.113549.1.1.`n` (RFC 4055 §2.1 and §5): 1 rsaEncryption, 5, 11, 12 and 13 the PKCS#1 v1.5 signatures, 8 MGF1, 10 RSASSA-PSS. */
const x509OidPkcs1 = (n: i32): u8[] => x509DerOidContents([1, 2, 840, 113549, 1, 1, n])

/** id-Ed25519, 1.3.101.112 (RFC 8410 §3). */
const x509OidEd25519 = (): u8[] => x509DerOidContents([1, 3, 101, 112])

/** The NIST hash arc 2.16.840.1.101.3.4.2.`n` (RFC 4055 §2.1): 1 SHA-256, 2 SHA-384, 3 SHA-512. */
const x509OidNistHash = (n: i32): u8[] => x509DerOidContents([2, 16, 840, 1, 101, 3, 4, 2, n])

// The extensions decoded, by their arc under 2.5.29 (RFC 5280 §4.2.1).
const X509_CE_SUBJECT_KEY_ID: i32 = 14
const X509_CE_KEY_USAGE: i32 = 15
const X509_CE_SUBJECT_ALT_NAME: i32 = 17
const X509_CE_BASIC_CONSTRAINTS: i32 = 19
const X509_CE_NAME_CONSTRAINTS: i32 = 30
const X509_CE_AUTHORITY_KEY_ID: i32 = 35
const X509_CE_EXT_KEY_USAGE: i32 = 37

/** What `x509ReadExtension` answers: an extension it does not decode, one it decoded, one that is malformed. */
const X509_EXT_UNKNOWN: i32 = 0
const X509_EXT_SOUND: i32 = 1
const X509_EXT_MALFORMED: i32 = 2

/** id-kp-serverAuth, 1.3.6.1.5.5.7.3.1 (RFC 5280 §4.2.1.12). */
const x509OidServerAuth = (): u8[] => x509DerOidContents([1, 3, 6, 1, 5, 5, 7, 3, 1])

/** anyExtendedKeyUsage, 2.5.29.37.0 (RFC 5280 §4.2.1.12). */
const x509OidAnyEku = (): u8[] => x509DerOidContents([2, 5, 29, 37, 0])

/**
 * Whether an OID's contents are X.690 §8.19's: at least one octet, the last
 * with its top bit clear, and no subidentifier starting with the padding
 * octet `0x80` — so one OID has one spelling, and a duplicate extension cannot
 * hide behind a second.
 */
const x509DerOidSound = (der: u8[], e: X509DerElement): boolean => {
  if (e.tag !== X509_TAG_OID || e.end <= e.start || toI32(der[e.end - 1]) >= 0x80) {
    return false
  }
  let first: boolean = true
  for (let k: i32 = e.start; k < e.end; k++) {
    // Always true for an element `x509DerRead` gave, and what lets the load drop its check.
    if (k >= 0 && k < toI32(der.length)) {
      const b: i32 = toI32(der[k])
      if (first && b === 0x80) {
        return false
      }
      first = b < 0x80
    }
  }
  return true
}

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
 * Whether an AlgorithmIdentifier SEQUENCE is `{ oid, NULL }`, the form RFC
 * 4055 §5 and RFC 3279 §2.3.1 give the PKCS#1 v1.5 signatures and the RSA key.
 */
const x509DerIsAlgorithmNull = (der: u8[], alg: X509DerElement, oid: u8[]): boolean => {
  if (alg.tag !== X509_TAG_SEQUENCE) {
    return false
  }
  const id: X509DerElement | null = x509DerExpect(der, alg.start, alg.end, X509_TAG_OID)
  if (id === null || !x509DerContentsAre(der, id, oid)) {
    return false
  }
  const params: X509DerElement | null = x509DerExpect(der, id.end, alg.end, X509_TAG_NULL)
  return params !== null && params.start === params.end && params.end === alg.end
}

/**
 * The `X509_HASH_` constant of a hash AlgorithmIdentifier in `der[start ..
 * end)`, exactly one element: SHA-256, SHA-384 or SHA-512, with its parameters
 * absent or NULL, both of which RFC 4055 §2.1 has a reader accept. 0 otherwise.
 */
const x509DerHashAlgorithm = (der: u8[], start: i32, end: i32): i32 => {
  const alg: X509DerElement | null = x509DerExpect(der, start, end, X509_TAG_SEQUENCE)
  if (alg === null || alg.end !== end) {
    return 0
  }
  for (let n: i32 = 1; n <= 3; n++) {
    const oid: u8[] = x509OidNistHash(n)
    if (x509DerIsAlgorithm(der, alg, oid, []) || x509DerIsAlgorithmNull(der, alg, oid)) {
      return n
    }
  }
  return 0
}

/** The signature algorithm `X509Certificate` reports, and for RSASSA-PSS its hash and salt length. */
class X509SigAlg {
  alg: i32 = 0
  hash: i32 = 0
  salt: i32 = 0
}

/**
 * RSASSA-PSS-params (RFC 4055 §3.1) in `der[start .. end)`, the contents of
 * their SEQUENCE: `[0]` hashAlgorithm, `[1]` maskGenAlgorithm, `[2]`
 * saltLength and `[3]` trailerField, each optional and in that order. Named
 * only when the hash is SHA-2 (so `[0]` is present, its DEFAULT being SHA-1),
 * the mask is MGF1 over that same hash, the salt length is 0 to 127 (20 when
 * absent) and the trailer is 1; anything else is `X509_SIG_UNKNOWN`, which a
 * verifier refuses. DER leaves a DEFAULT out (X.690 §11.5), so a salt length
 * of 20 written out, or any trailerField at all (its one value, 1, being the
 * DEFAULT), is unknown too.
 */
const x509PssParams = (der: u8[], start: i32, end: i32): X509SigAlg => {
  const out = new X509SigAlg()
  const hashWrap: X509DerElement | null = x509DerExpect(der, start, end, 0xa0)
  if (hashWrap === null) {
    return out
  }
  const hash: i32 = x509DerHashAlgorithm(der, hashWrap.start, hashWrap.end)
  const mgfWrap: X509DerElement | null = x509DerExpect(der, hashWrap.end, end, 0xa1)
  if (hash === 0 || mgfWrap === null) {
    return out
  }
  // MaskGenAlgorithm is `SEQUENCE { id-mgf1, HashAlgorithm }`, and the hash
  // must be the message's (RFC 4055 §3.1 recommends it; RFC 8446 §4.2.3 and
  // the CA/Browser Forum require it).
  const mgf: X509DerElement | null = x509DerExpect(der, mgfWrap.start, mgfWrap.end, X509_TAG_SEQUENCE)
  if (mgf === null || mgf.end !== mgfWrap.end) {
    return out
  }
  const mgfId: X509DerElement | null = x509DerExpect(der, mgf.start, mgf.end, X509_TAG_OID)
  if (mgfId === null || !x509DerContentsAre(der, mgfId, x509OidPkcs1(8))) {
    return out
  }
  if (x509DerHashAlgorithm(der, mgfId.end, mgf.end) !== hash) {
    return out
  }
  let at: i32 = mgfWrap.end
  let salt: i32 = 20
  if (x509DerPeek(der, at, end) === 0xa2) {
    const saltWrap: X509DerElement | null = x509DerRead(der, at, end)
    if (saltWrap === null) {
      return out
    }
    const value: X509DerElement | null = x509DerRead(der, saltWrap.start, saltWrap.end)
    if (value === null || value.end !== saltWrap.end) {
      return out
    }
    salt = x509DerSmallInteger(der, value)
    if (salt < 0 || salt === 20) {
      return out
    }
    at = saltWrap.end
  }
  if (at !== end) {
    return out
  }
  out.alg = X509_SIG_RSA_PSS
  out.hash = hash
  out.salt = salt
  return out
}

/** The signature algorithm an AlgorithmIdentifier names, with the parameters RFC 5758, RFC 4055 and RFC 8410 give each. */
const x509SignatureAlgorithm = (der: u8[], alg: X509DerElement): X509SigAlg => {
  const out = new X509SigAlg()
  if (x509DerIsAlgorithm(der, alg, x509OidEcdsaSha256(), [])) {
    out.alg = X509_SIG_ECDSA_SHA256
  } else if (x509DerIsAlgorithm(der, alg, x509OidEcdsaSha384(), [])) {
    out.alg = X509_SIG_ECDSA_SHA384
  } else if (x509DerIsAlgorithmNull(der, alg, x509OidPkcs1(11))) {
    out.alg = X509_SIG_RSA_PKCS1_SHA256
  } else if (x509DerIsAlgorithmNull(der, alg, x509OidPkcs1(12))) {
    out.alg = X509_SIG_RSA_PKCS1_SHA384
  } else if (x509DerIsAlgorithmNull(der, alg, x509OidPkcs1(13))) {
    out.alg = X509_SIG_RSA_PKCS1_SHA512
  } else if (x509DerIsAlgorithmNull(der, alg, x509OidPkcs1(5))) {
    out.alg = X509_SIG_RSA_PKCS1_SHA1
  } else if (x509DerIsAlgorithm(der, alg, x509OidEd25519(), [])) {
    out.alg = X509_SIG_ED25519
  } else {
    const id: X509DerElement | null = x509DerExpect(der, alg.start, alg.end, X509_TAG_OID)
    if (id !== null && x509DerContentsAre(der, id, x509OidPkcs1(10))) {
      // The parameters are required: RFC 4055 §3.1 gives them no absent form.
      const params: X509DerElement | null = x509DerExpect(der, id.end, alg.end, X509_TAG_SEQUENCE)
      if (params !== null && params.end === alg.end) {
        return x509PssParams(der, params.start, params.end)
      }
    }
  }
  return out
}

/** The `X509_KEY_` constant a SubjectPublicKeyInfo's AlgorithmIdentifier names. */
const x509KeyType = (der: u8[], alg: X509DerElement): i32 => {
  if (x509DerIsAlgorithm(der, alg, x509OidEcPublicKey(), x509OidPrime256v1())) {
    return X509_KEY_P256
  }
  if (x509DerIsAlgorithm(der, alg, x509OidEcPublicKey(), x509OidSecp384r1())) {
    return X509_KEY_P384
  }
  if (x509DerIsAlgorithmNull(der, alg, x509OidPkcs1(1))) {
    return X509_KEY_RSA
  }
  if (x509DerIsAlgorithm(der, alg, x509OidEd25519(), [])) {
    return X509_KEY_ED25519
  }
  return X509_KEY_UNKNOWN
}

/**
 * A minimal, non-negative INTEGER right-aligned into `out[off .. off +
 * width)`, or `false` when it is negative, not minimal or wider than `width`
 * octets once a sign octet is set aside.
 */
const x509DerUnsignedInto = (der: u8[], e: X509DerElement, out: u8[], off: i32, width: i32): boolean => {
  if (!x509DerIntegerMinimal(der, e) || toI32(der[e.start]) >= 0x80) {
    return false
  }
  let start: i32 = e.start
  if (toI32(der[start]) === 0 && e.end - start > 1) {
    start = start + 1
  }
  const n: i32 = e.end - start
  if (n > width) {
    return false
  }
  for (let k: i32 = 0; k < n; k++) {
    out[off + width - n + k] = der[start + k]
  }
  return true
}

/**
 * `r || s`, `width` octets each, out of an ECDSA-Sig-Value `SEQUENCE { INTEGER
 * r, INTEGER s }` (RFC 5480 §2.2 by way of RFC 3279 §2.2.3), or `null` unless
 * it is exactly one with both integers minimal, not negative and below
 * 2^(8 * width), and `width` is 32 (P-256) or 48 (P-384). This is the form a
 * TLS `CertificateVerify` or an X.509 signature carries; that each value is
 * below the curve's order is the curve's check.
 */
export const x509DerSignatureRSWidth = (sig: u8[], width: i32): u8[] | null => {
  if (width !== 32 && width !== 48) {
    return null
  }
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
  const out: u8[] = new Array<u8>(2 * width)
  if (!x509DerUnsignedInto(sig, r, out, 0, width) || !x509DerUnsignedInto(sig, s, out, width, width)) {
    return null
  }
  return out
}

/**
 * `x509DerSignatureRSWidth` for P-256: `r || s`, 32 octets each, the form
 * `nish/crypto/p256` takes.
 */
export const x509DerSignatureRS = (sig: u8[]): u8[] | null => x509DerSignatureRSWidth(sig, 32)

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
// Certificates (RFC 5280 §4.1)
// ---------------------------------------------------------------------------

/**
 * Whether a Name in `der[e.start .. e.end)`, the contents of its SEQUENCE, is
 * RFC 5280 §4.1.2.4's `SEQUENCE OF RelativeDistinguishedName`: each RDN a
 * non-empty SET of `SEQUENCE { type OID, value }`, one element each, nothing
 * between or after. The values' string types are not read (the common name is
 * the mint's own), and DER's sorted SET OF is not checked: a validator compares
 * Names byte for byte, so an unsorted SET only fails to match.
 */
const x509DerNameSound = (der: u8[], e: X509DerElement): boolean => {
  let at: i32 = e.start
  while (at < e.end) {
    const rdn: X509DerElement | null = x509DerExpect(der, at, e.end, X509_TAG_SET)
    if (rdn === null || rdn.end === rdn.start) {
      return false
    }
    let inner: i32 = rdn.start
    while (inner < rdn.end) {
      const pair: X509DerElement | null = x509DerExpect(der, inner, rdn.end, X509_TAG_SEQUENCE)
      if (pair === null) {
        return false
      }
      const type: X509DerElement | null = x509DerExpect(der, pair.start, pair.end, X509_TAG_OID)
      if (type === null || !x509DerOidSound(der, type)) {
        return false
      }
      const value: X509DerElement | null = x509DerRead(der, type.end, pair.end)
      if (value === null || value.end !== pair.end) {
        return false
      }
      inner = pair.end
    }
    at = rdn.end
  }
  return true
}

/**
 * Whether two Names are the same: their DER, byte for byte. RFC 5280 §7.1's
 * comparison — case folded and white space collapsed after a stringprep of
 * each attribute — is not implemented (X509-12 in docs/security/crypto-x509.md),
 * so two Names spelled differently that it would match answer `false`. That
 * fails closed: a chain whose issuer and subject differ only so is not built.
 */
export const x509NameEqual = (a: u8[], b: u8[]): boolean => x509BytesEqual(a, b)

/**
 * Whether the Name `base` is a prefix of the Name `name`, both whole DER as
 * `X509Certificate.issuer` and `subject` hold them: each of `base`'s RDNs is
 * `name`'s RDN at the same place, byte for byte — how a directoryName
 * constraint (RFC 5280 §4.2.1.10) is matched. An empty `base` is a prefix of
 * every Name. `false` when either is not a Name.
 */
export const x509NameIsPrefix = (base: u8[], name: u8[]): boolean => {
  const b: X509DerElement | null = x509DerExpect(base, 0, toI32(base.length), X509_TAG_SEQUENCE)
  const n: X509DerElement | null = x509DerExpect(name, 0, toI32(name.length), X509_TAG_SEQUENCE)
  if (b === null || n === null || b.end !== toI32(base.length) || n.end !== toI32(name.length)) {
    return false
  }
  if (!x509DerNameSound(base, b) || !x509DerNameSound(name, n)) {
    return false
  }
  let atB: i32 = b.start
  let atN: i32 = n.start
  while (atB < b.end) {
    const rdnB: X509DerElement | null = x509DerRead(base, atB, b.end)
    const rdnN: X509DerElement | null = x509DerRead(name, atN, n.end)
    if (
      rdnB === null ||
      rdnN === null ||
      !x509BytesEqual(x509DerWhole(base, rdnB), x509DerWhole(name, rdnN))
    ) {
      return false
    }
    atB = rdnB.end
    atN = rdnN.end
  }
  return true
}

/**
 * Whether an IA5String's contents are what a name may hold: every octet below
 * 0x80 (X.680 §41's IA5 is seven-bit), and none NUL, the old
 * `localhost\0.example` confusion a C reader would cut short.
 */
const x509DerIa5Name = (der: u8[], e: X509DerElement): boolean => {
  for (let k: i32 = e.start; k < e.end; k++) {
    // Always true for an element `x509DerRead` gave, and what lets the load drop its check.
    if (k >= 0 && k < toI32(der.length)) {
      const b: i32 = toI32(der[k])
      if (b === 0 || b >= 0x80) {
        return false
      }
    }
  }
  return true
}

/** `der[e.start .. e.end)` as a string, one character per octet, as `x509Bytes` reads one back. */
const x509DerText = (der: u8[], e: X509DerElement): string => String.fromBytes(der, e.start, e.end)

/**
 * The form of one GeneralName (RFC 5280 §4.2.1.6), its IMPLICIT tag checked
 * against its form — primitive for the strings, the address and the OID,
 * constructed for the rest — or -1 when it is malformed: a tag no form has, a
 * name string that is not `x509DerIa5Name`, or a directoryName that is not
 * exactly one sound Name. An iPAddress's length is the caller's to check,
 * since a subtree's is twice a name's.
 */
const x509GeneralNameKind = (der: u8[], e: X509DerElement): i32 => {
  const tag: i32 = e.tag
  if (tag === 0x82) {
    return x509DerIa5Name(der, e) ? X509_GN_DNS : -1
  }
  if (tag === 0x87) {
    return X509_GN_IP
  }
  if (tag === 0xa4) {
    const name: X509DerElement | null = x509DerExpect(der, e.start, e.end, X509_TAG_SEQUENCE)
    return name !== null && name.end === e.end && x509DerNameSound(der, name) ? X509_GN_DIR : -1
  }
  // rfc822Name [1] and uniformResourceIdentifier [6] are IA5 strings too.
  if (tag === 0x81 || tag === 0x86) {
    return x509DerIa5Name(der, e) ? X509_GN_OTHER : -1
  }
  // otherName [0] is `type-id OID, value [0] EXPLICIT ANY`, and registeredID
  // [8] an IMPLICIT OID.
  if (tag === 0xa0) {
    const typeId: X509DerElement | null = x509DerRead(der, e.start, e.end)
    const value: X509DerElement | null = typeId === null ? null : x509DerExpect(der, typeId.end, e.end, 0xa0)
    return typeId !== null && x509DerOidSound(der, typeId) && value !== null && value.end === e.end
      ? X509_GN_OTHER
      : -1
  }
  if (tag === 0x88) {
    return x509DerOidSound(der, new X509DerElement(X509_TAG_OID, e.at, e.start, e.end)) ? X509_GN_OTHER : -1
  }
  // x400Address [3] and ediPartyName [5], whose contents are not read.
  if (tag === 0xa3 || tag === 0xa5) {
    return X509_GN_OTHER
  }
  return -1
}

/**
 * subjectAltName (RFC 5280 §4.2.1.6), `SEQUENCE SIZE (1..MAX) OF
 * GeneralName`, into `out`: each dNSName and iPAddress (4 or 16 octets) kept,
 * the other forms counted. `false` when it is malformed, or holds an empty
 * dNSName, which §4.2.1.6 forbids (in a name constraint, empty is every name).
 */
const x509ReadSubjectAltName = (der: u8[], start: i32, end: i32, out: X509Certificate): boolean => {
  const seq: X509DerElement | null = x509DerExpect(der, start, end, X509_TAG_SEQUENCE)
  if (seq === null || seq.end !== end || seq.end === seq.start) {
    return false
  }
  // Declared once and read into, so a pass leaves only what it keeps.
  const name = new X509DerElement(0, 0, 0, 0)
  let at: i32 = seq.start
  while (at < seq.end) {
    if (!x509DerReadInto(der, at, seq.end, name)) {
      return false
    }
    const kind: i32 = x509GeneralNameKind(der, name)
    const length: i32 = name.end - name.start
    if (kind === X509_GN_DNS && length > 0) {
      out.sanDns.push(x509DerText(der, name))
    } else if (kind === X509_GN_IP && (length === 4 || length === 16)) {
      out.sanIp.push(x509DerSlice(der, name.start, name.end))
    } else if (kind === X509_GN_DIR || kind === X509_GN_OTHER) {
      out.sanOther = out.sanOther + 1
    } else {
      return false
    }
    at = name.end
  }
  out.sanPresent = true
  return true
}

/**
 * The value of a minimal, non-negative INTEGER below 2^31, or -1: a
 * pathLenConstraint, which RFC 5280 §4.2.1.9 makes `INTEGER (0..MAX)`.
 */
const x509DerNonNegative = (der: u8[], e: X509DerElement): i32 => {
  const n: i32 = e.end - e.start
  if (e.tag !== X509_TAG_INTEGER || !x509DerIntegerMinimal(der, e) || toI32(der[e.start]) >= 0x80 || n > 4) {
    return -1
  }
  let value: i32 = 0
  for (let k: i32 = e.start; k < e.end; k++) {
    // Always true for an element `x509DerRead` gave, and what lets the load drop its check.
    if (k >= 0 && k < toI32(der.length)) {
      value = (value << 8) | toI32(der[k])
    }
  }
  return value
}

/** Whether `e` is DER's TRUE, `01 01 ff`: a DEFAULT FALSE is left out (X.690 §11.5), so a present BOOLEAN is TRUE. */
const x509DerIsTrue = (der: u8[], e: X509DerElement): boolean =>
  e.tag === X509_TAG_BOOLEAN && e.end - e.start === 1 && toI32(der[e.start]) === 0xff

/**
 * basicConstraints (RFC 5280 §4.2.1.9), `SEQUENCE { cA BOOLEAN DEFAULT FALSE,
 * pathLenConstraint INTEGER (0..MAX) OPTIONAL }`, into `out`. `false` when it
 * is malformed: a cA that is not DER's TRUE, a negative or non-minimal path
 * length, or anything after it.
 */
const x509ReadBasicConstraints = (der: u8[], start: i32, end: i32, out: X509Certificate): boolean => {
  const seq: X509DerElement | null = x509DerExpect(der, start, end, X509_TAG_SEQUENCE)
  if (seq === null || seq.end !== end) {
    return false
  }
  let at: i32 = seq.start
  if (x509DerPeek(der, at, seq.end) === X509_TAG_BOOLEAN) {
    const ca: X509DerElement | null = x509DerRead(der, at, seq.end)
    if (ca === null || !x509DerIsTrue(der, ca)) {
      return false
    }
    out.bcCa = true
    at = ca.end
  }
  if (at < seq.end) {
    const pathLen: X509DerElement | null = x509DerRead(der, at, seq.end)
    if (pathLen === null || pathLen.end !== seq.end) {
      return false
    }
    out.bcPathLen = x509DerNonNegative(der, pathLen)
    if (out.bcPathLen < 0) {
      return false
    }
  }
  out.bcPresent = true
  return true
}

/**
 * keyUsage (RFC 5280 §4.2.1.3), a BIT STRING of named bits 0 to 8, into
 * `out.keyUsage`. `false` when it is malformed: unused bits that are not
 * zero, no bit set (§4.2.1.3 requires one), a trailing zero bit DER would
 * have dropped (X.690 §11.2.2), or a bit past decipherOnly.
 */
const x509ReadKeyUsage = (der: u8[], start: i32, end: i32, out: X509Certificate): boolean => {
  const bits: X509DerElement | null = x509DerExpect(der, start, end, X509_TAG_BIT_STRING)
  if (bits === null || bits.end !== end || !x509DerBitStringSound(der, bits)) {
    return false
  }
  const n: i32 = bits.end - bits.start - 1
  if (n < 1 || n > 2) {
    return false
  }
  const unused: i32 = toI32(der[bits.start])
  if (((toI32(der[bits.end - 1]) >> unused) & 1) !== 1) {
    return false
  }
  let mask: i32 = 0
  for (let j: i32 = 0; j < n; j++) {
    const octet: i32 = toI32(der[bits.start + 1 + j])
    for (let b: i32 = 0; b < 8; b++) {
      if (((octet >> (7 - b)) & 1) === 1) {
        const bit: i32 = 8 * j + b
        mask = mask | (toI32(1) << bit)
      }
    }
  }
  // Past decipherOnly, bit 8.
  if (mask >= 512) {
    return false
  }
  out.keyUsage = mask
  return true
}

/**
 * extKeyUsage (RFC 5280 §4.2.1.12), `SEQUENCE SIZE (1..MAX) OF KeyPurposeId`,
 * into `out`: whether it names serverAuth and anyExtendedKeyUsage. `false`
 * when it is empty or holds anything but sound OIDs.
 */
const x509ReadExtKeyUsage = (der: u8[], start: i32, end: i32, out: X509Certificate): boolean => {
  const seq: X509DerElement | null = x509DerExpect(der, start, end, X509_TAG_SEQUENCE)
  if (seq === null || seq.end !== end || seq.end === seq.start) {
    return false
  }
  const serverAuth: u8[] = x509OidServerAuth()
  const anyEku: u8[] = x509OidAnyEku()
  let at: i32 = seq.start
  while (at < seq.end) {
    const purpose: X509DerElement | null = x509DerExpect(der, at, seq.end, X509_TAG_OID)
    if (purpose === null || !x509DerOidSound(der, purpose)) {
      return false
    }
    if (x509DerContentsAre(der, purpose, serverAuth)) {
      out.ekuServerAuth = true
    } else if (x509DerContentsAre(der, purpose, anyEku)) {
      out.ekuAny = true
    }
    at = purpose.end
  }
  out.ekuPresent = true
  return true
}

/** Whether `mask` is ones and then zeros, as an iPAddress constraint's mask must be (RFC 5280 §4.2.1.10). */
const x509MaskContiguous = (mask: u8[]): boolean => {
  let zeroSeen: boolean = false
  for (let k: i32 = 0; k < toI32(mask.length); k++) {
    const octet: i32 = toI32(mask[k])
    for (let b: i32 = 7; b >= 0; b--) {
      const one: boolean = ((octet >> b) & 1) === 1
      if (one && zeroSeen) {
        return false
      }
      zeroSeen = zeroSeen || !one
    }
  }
  return true
}

/** Whether a GeneralSubtree's IMPLICIT `BaseDistance` bound is a minimal, non-negative INTEGER. */
const x509DerBoundSound = (der: u8[], e: X509DerElement): boolean =>
  x509DerIntegerMinimal(der, e) && toI32(der[e.start]) < 0x80

/**
 * The GeneralSubtrees filling an IMPLICIT `[0]` or `[1]` of nameConstraints
 * (RFC 5280 §4.2.1.10), `SIZE (1..MAX) OF GeneralSubtree`, pushed onto
 * `into`. Each is `SEQUENCE { base GeneralName, minimum [0] DEFAULT 0, maximum
 * [1] OPTIONAL }`: a subtree with a minimum other than 0, or a maximum, sets
 * `out.ncUnsupported`, since §4.2.1.10 has the minimum 0 and the maximum
 * absent. `false` when it is malformed: a minimum of 0 written out (DER leaves
 * a DEFAULT out), a bound that is not a minimal non-negative INTEGER, anything
 * else after the base, or an iPAddress that is not 8 or 32 octets or whose
 * mask is not contiguous.
 */
const x509ReadSubtrees = (
  der: u8[],
  e: X509DerElement,
  into: X509GeneralSubtree[],
  out: X509Certificate
): boolean => {
  if (e.end === e.start) {
    return false
  }
  // Declared once and read into, so a pass leaves only the subtree it keeps.
  const tree = new X509DerElement(0, 0, 0, 0)
  const base = new X509DerElement(0, 0, 0, 0)
  const minimum = new X509DerElement(0, 0, 0, 0)
  const maximum = new X509DerElement(0, 0, 0, 0)
  let at: i32 = e.start
  while (at < e.end) {
    if (!x509DerExpectInto(der, at, e.end, X509_TAG_SEQUENCE, tree)) {
      return false
    }
    if (!x509DerReadInto(der, tree.start, tree.end, base)) {
      return false
    }
    const subtree = new X509GeneralSubtree()
    subtree.kind = x509GeneralNameKind(der, base)
    const length: i32 = base.end - base.start
    if (subtree.kind === X509_GN_DNS) {
      subtree.dns = x509DerText(der, base)
    } else if (subtree.kind === X509_GN_IP) {
      if (length !== 8 && length !== 32) {
        return false
      }
      subtree.ip = x509DerSlice(der, base.start, base.start + length / 2)
      subtree.mask = x509DerSlice(der, base.start + length / 2, base.end)
      if (!x509MaskContiguous(subtree.mask)) {
        return false
      }
    } else if (subtree.kind === X509_GN_DIR) {
      subtree.dirName = x509DerSlice(der, base.start, base.end)
    } else if (subtree.kind === X509_GN_OTHER) {
      out.ncUnsupported = true
    } else {
      return false
    }
    let bound: i32 = base.end
    if (x509DerPeek(der, bound, tree.end) === 0x80) {
      if (
        !x509DerReadInto(der, bound, tree.end, minimum) ||
        !x509DerBoundSound(der, minimum) ||
        (minimum.end - minimum.start === 1 && toI32(der[minimum.start]) === 0)
      ) {
        return false
      }
      out.ncUnsupported = true
      bound = minimum.end
    }
    if (x509DerPeek(der, bound, tree.end) === 0x81) {
      if (!x509DerReadInto(der, bound, tree.end, maximum) || !x509DerBoundSound(der, maximum)) {
        return false
      }
      out.ncUnsupported = true
      bound = maximum.end
    }
    if (bound !== tree.end) {
      return false
    }
    into.push(subtree)
    at = tree.end
  }
  return true
}

/**
 * nameConstraints (RFC 5280 §4.2.1.10), `SEQUENCE { permittedSubtrees [0]
 * OPTIONAL, excludedSubtrees [1] OPTIONAL }`, into `out`. `false` when it is
 * malformed, or empty, which §4.2.1.10 forbids.
 */
const x509ReadNameConstraints = (der: u8[], start: i32, end: i32, out: X509Certificate): boolean => {
  const seq: X509DerElement | null = x509DerExpect(der, start, end, X509_TAG_SEQUENCE)
  if (seq === null || seq.end !== end || seq.end === seq.start) {
    return false
  }
  let at: i32 = seq.start
  if (x509DerPeek(der, at, seq.end) === 0xa0) {
    const permitted: X509DerElement | null = x509DerRead(der, at, seq.end)
    if (permitted === null || !x509ReadSubtrees(der, permitted, out.ncPermitted, out)) {
      return false
    }
    at = permitted.end
  }
  if (x509DerPeek(der, at, seq.end) === 0xa1) {
    const excluded: X509DerElement | null = x509DerRead(der, at, seq.end)
    if (excluded === null || !x509ReadSubtrees(der, excluded, out.ncExcluded, out)) {
      return false
    }
    at = excluded.end
  }
  out.ncPresent = true
  return at === seq.end
}

/** subjectKeyIdentifier (RFC 5280 §4.2.1.2), one OCTET STRING, into `out.skid`; `false` when it is malformed or empty. */
const x509ReadSubjectKeyId = (der: u8[], start: i32, end: i32, out: X509Certificate): boolean => {
  const id: X509DerElement | null = x509DerExpect(der, start, end, X509_TAG_OCTET_STRING)
  if (id === null || id.end !== end || id.end === id.start) {
    return false
  }
  out.skid = x509DerSlice(der, id.start, id.end)
  return true
}

/** Whether `e`'s contents are a non-empty run of well-formed GeneralNames. */
const x509GeneralNamesSound = (der: u8[], e: X509DerElement): boolean => {
  if (e.end === e.start) {
    return false
  }
  let at: i32 = e.start
  while (at < e.end) {
    const name: X509DerElement | null = x509DerRead(der, at, e.end)
    if (name === null || x509GeneralNameKind(der, name) === -1) {
      return false
    }
    at = name.end
  }
  return true
}

/**
 * authorityKeyIdentifier (RFC 5280 §4.2.1.1), `SEQUENCE { keyIdentifier [0]
 * OPTIONAL, authorityCertIssuer [1] OPTIONAL, authorityCertSerialNumber [2]
 * OPTIONAL }`, its keyIdentifier, which may not be empty, into `out.akid`.
 * The other two are held to their order, to being both present or both
 * absent, as §4.2.1.1 has them, to a non-empty GeneralNames and a minimal
 * INTEGER, and not kept. `false` when it is malformed.
 */
const x509ReadAuthorityKeyId = (der: u8[], start: i32, end: i32, out: X509Certificate): boolean => {
  const seq: X509DerElement | null = x509DerExpect(der, start, end, X509_TAG_SEQUENCE)
  if (seq === null || seq.end !== end) {
    return false
  }
  let at: i32 = seq.start
  if (x509DerPeek(der, at, seq.end) === 0x80) {
    const id: X509DerElement | null = x509DerRead(der, at, seq.end)
    if (id === null || id.end === id.start) {
      return false
    }
    out.akid = x509DerSlice(der, id.start, id.end)
    at = id.end
  }
  if (x509DerPeek(der, at, seq.end) === 0xa1) {
    const issuer: X509DerElement | null = x509DerRead(der, at, seq.end)
    const serial: X509DerElement | null =
      issuer === null ? null : x509DerExpect(der, issuer.end, seq.end, 0x82)
    if (
      issuer === null ||
      serial === null ||
      !x509GeneralNamesSound(der, issuer) ||
      !x509DerIntegerMinimal(der, serial)
    ) {
      return false
    }
    at = serial.end
  }
  return at === seq.end
}

/**
 * One extension's value, the contents of its extnValue OCTET STRING, decoded
 * into `out` by the arc `ce` it has under 2.5.29: `X509_EXT_SOUND`, or
 * `X509_EXT_MALFORMED`. An extension this module does not decode answers
 * `X509_EXT_UNKNOWN` with `out` untouched, and `ce` is -1 for one outside the
 * arc.
 */
const x509ReadExtension = (der: u8[], ce: i32, start: i32, end: i32, out: X509Certificate): i32 => {
  let sound: boolean = false
  if (ce === X509_CE_SUBJECT_ALT_NAME) {
    sound = x509ReadSubjectAltName(der, start, end, out)
  } else if (ce === X509_CE_BASIC_CONSTRAINTS) {
    sound = x509ReadBasicConstraints(der, start, end, out)
  } else if (ce === X509_CE_KEY_USAGE) {
    sound = x509ReadKeyUsage(der, start, end, out)
  } else if (ce === X509_CE_EXT_KEY_USAGE) {
    sound = x509ReadExtKeyUsage(der, start, end, out)
  } else if (ce === X509_CE_NAME_CONSTRAINTS) {
    sound = x509ReadNameConstraints(der, start, end, out)
  } else if (ce === X509_CE_SUBJECT_KEY_ID) {
    sound = x509ReadSubjectKeyId(der, start, end, out)
  } else if (ce === X509_CE_AUTHORITY_KEY_ID) {
    sound = x509ReadAuthorityKeyId(der, start, end, out)
  } else {
    return X509_EXT_UNKNOWN
  }
  return sound ? X509_EXT_SOUND : X509_EXT_MALFORMED
}

/** The arc under 2.5.29 an extnID names, 1 to 127 (one octet), or -1 for an OID outside it. */
const x509ExtensionArc = (der: u8[], id: X509DerElement): i32 => {
  if (id.end - id.start !== 3 || toI32(der[id.start]) !== 0x55 || toI32(der[id.start + 1]) !== 0x1d) {
    return -1
  }
  const arc: i32 = toI32(der[id.start + 2])
  return arc < 0x80 ? arc : -1
}

/**
 * The `[3]` extensions wrapper read into `out` (RFC 5280 §4.1 and §4.2): one
 * non-empty SEQUENCE of `SEQUENCE { extnID OID, critical BOOLEAN DEFAULT
 * FALSE, extnValue OCTET STRING }` and nothing after it. `false` when any is
 * malformed, a critical flag is not DER's TRUE, an OID appears twice (§4.2:
 * "MUST NOT include more than one instance"), there are more than
 * `X509_MAX_EXTENSIONS`, or a decoded extension is malformed. A critical
 * extension this module does not decode sets `out.unknownCritical`; a
 * non-critical one is skipped.
 */
const x509ReadExtensions = (der: u8[], e: X509DerElement, out: X509Certificate): boolean => {
  const seq: X509DerElement | null = x509DerExpect(der, e.start, e.end, X509_TAG_SEQUENCE)
  if (seq === null || seq.end !== e.end || seq.end === seq.start) {
    return false
  }
  // Every extnID so far, to find a second instance by its encoding, which
  // `x509DerOidSound` makes the only one.
  const seen: u8[][] = []
  // Declared once and read into, so a pass leaves only the extnID it keeps.
  const ext = new X509DerElement(0, 0, 0, 0)
  const id = new X509DerElement(0, 0, 0, 0)
  const flag = new X509DerElement(0, 0, 0, 0)
  const value = new X509DerElement(0, 0, 0, 0)
  let at: i32 = seq.start
  while (at < seq.end) {
    if (
      toI32(seen.length) >= X509_MAX_EXTENSIONS ||
      !x509DerExpectInto(der, at, seq.end, X509_TAG_SEQUENCE, ext)
    ) {
      return false
    }
    if (!x509DerExpectInto(der, ext.start, ext.end, X509_TAG_OID, id) || !x509DerOidSound(der, id)) {
      return false
    }
    const oid: u8[] = x509DerSlice(der, id.start, id.end)
    for (const other of seen) {
      if (x509BytesEqual(other, oid)) {
        return false
      }
    }
    seen.push(oid)
    let next: i32 = id.end
    let critical: boolean = false
    if (x509DerPeek(der, next, ext.end) === X509_TAG_BOOLEAN) {
      if (!x509DerReadInto(der, next, ext.end, flag) || !x509DerIsTrue(der, flag)) {
        return false
      }
      critical = true
      next = flag.end
    }
    if (!x509DerExpectInto(der, next, ext.end, X509_TAG_OCTET_STRING, value) || value.end !== ext.end) {
      return false
    }
    const read: i32 = x509ReadExtension(der, x509ExtensionArc(der, id), value.start, value.end, out)
    if (read === X509_EXT_MALFORMED) {
      return false
    }
    if (read === X509_EXT_UNKNOWN) {
      out.unknownCritical = out.unknownCritical || critical
    }
    at = ext.end
  }
  return true
}

/**
 * `der` read as one Certificate (RFC 5280 §4.1), or `null` unless it is
 * exactly one in DER: `SEQUENCE { tbsCertificate, signatureAlgorithm,
 * signatureValue }`, where tbsCertificate holds an explicit version of v2 or
 * v3 or none (DER omits v1, the default), a minimal serial, an algorithm equal
 * to the outer one byte for byte (§4.1.1.2), issuer and subject Names, a
 * Validity of two valid times, a SubjectPublicKeyInfo whose key is whole
 * octets, then only the optional `[1]` and `[2]` unique identifiers (v2 and
 * v3) and `[3]` extensions (v3), in that order. Issuer and subject must be
 * sound Names. The signature algorithm is named in `sigAlg` (with `pssHash`
 * and `pssSaltLen` for RSA-PSS) and the key in `keyType`; `p256` and
 * `ecdsaSha256` say whether they are the ones `x509VerifySignature` checks.
 *
 * Extensions are read: subjectAltName, basicConstraints, keyUsage,
 * extKeyUsage, nameConstraints and the two key identifiers are decoded into
 * their fields, and `null` is the answer when any of them is malformed or any
 * extension appears twice. A critical extension it does not decode sets
 * `unknownCritical`, which RFC 5280 §4.2 obliges a validator to refuse.
 *
 * **A parser, not a validator.** It checks that the bytes are one certificate
 * and what its extensions say. It does not check the signature
 * (`x509VerifySignature` does), that `notBefore` is not after `notAfter` or
 * that either is near any clock, or what the extensions mean for a chain,
 * which is a path validator's to apply.
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
  if (issuer === null || !x509DerNameSound(der, issuer)) {
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
  if (subject === null || !x509DerNameSound(der, subject)) {
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
  const out = new X509Certificate()
  at = spki.end
  // [1] issuerUniqueID and [2] subjectUniqueID are IMPLICIT BIT STRINGs (so
  // primitive, 0x81 and 0x82) from v2, held to their shape and not read; [3]
  // extensions is explicit (0xa3), v3, and read into `out`.
  const trailing: i32[] = [0x81, 0x82, 0xa3]
  const e = new X509DerElement(0, 0, 0, 0)
  for (let i: i32 = 0; i < toI32(trailing.length); i++) {
    if (x509DerPeek(der, at, tbs.end) === trailing[i]) {
      if (!x509DerReadInto(der, at, tbs.end, e) || version < (i === 2 ? 2 : 1)) {
        return null
      }
      if (i === 2 ? !x509ReadExtensions(der, e, out) : !x509DerBitStringSound(der, e)) {
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
  const sigAlg: X509SigAlg = x509SignatureAlgorithm(der, outerAlg)
  out.version = version
  out.sigAlg = sigAlg.alg
  out.pssHash = sigAlg.hash
  out.pssSaltLen = sigAlg.salt
  out.keyType = x509KeyType(der, keyAlg)
  out.der = x509DerSlice(der, 0, total)
  out.tbs = x509DerWhole(der, tbs)
  out.serial = x509DerSlice(der, serial.start, serial.end)
  out.issuer = x509DerWhole(der, issuer)
  out.subject = x509DerWhole(der, subject)
  out.publicKey = publicKey
  out.p256 = out.keyType === X509_KEY_P256
  out.notBefore = before
  out.notAfter = after
  out.signature = signature
  out.ecdsaSha256 = out.sigAlg === X509_SIG_ECDSA_SHA256
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
 * clock, nor what each one's basicConstraints, keyUsage and name constraints
 * allow, nor a trust anchor. Nothing here does RFC 5280 §6's path
 * validation, and a chain this answers is no evidence that anyone
 * vouches for the leaf.
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
 * whether `issuer` may issue at all (`bcCa`, `keyUsage`) is a path
 * validator's to decide, so a `true` here is not path validation.
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

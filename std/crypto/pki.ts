/**
 * `nish/crypto/pki` — whether the certificate chain a TLS server sent leads to
 * a root the program trusts and names the host it dialled: RFC 5280 §6 path
 * validation and RFC 6125 §6 hostname matching, at the instant the caller
 * gives.
 *
 *     import { pkiLoadSystemRoots } from "nish/crypto/pki-roots";
 *     import { PKI_OK, PkiResult, PkiTrustStore, pkiReason, pkiTrustStore, pkiVerifyServer } from "nish/crypto/pki";
 *
 *     const store: PkiTrustStore = pkiTrustStore(pkiLoadSystemRoots().roots);
 *     // chain: each certificate's DER as the server sent it, its own first
 *     const r: PkiResult = pkiVerifyServer(chain, "example.com", toI64(Date.now()), store);
 *     if (r.code !== PKI_OK) {
 *       console.log(pkiReason(r.code));
 *     }
 *     // r.path, when PKI_OK: the leaf first, the trusted root last
 *
 * The network chooses every byte of `chain` (docs/security/crypto-pki.md,
 * "Threat model"), so every refusal has a reason code of its own and every
 * cost has a named bound: the certificates and bytes of a chain, the names
 * and subtrees of a certificate, the certificates of a path, the signatures
 * checked and the name comparisons made by one call.
 *
 * The chain's first certificate is the leaf; the rest are a pool, in any
 * order and possibly with extras, as servers send them. A path is searched
 * for depth first from the leaf: an issuer is a root of the store, tried
 * first, or a pool certificate, whose subject is the child's issuer Name byte
 * for byte, and whose subjectKeyIdentifier, when both it and the child's
 * authorityKeyIdentifier are present, is that identifier. A certificate is
 * never twice in a path. A path ends at a root, whose own signature is not
 * read, but whose validity, critical extensions, basicConstraints,
 * extKeyUsage, name constraints and key identifiers are checked as an
 * intermediate's are, as x509-limbo's cases ask. Every check of an issuer is
 * made as it is added, against the certificates below it, so a refusal ends
 * that branch at once; the leaf's profile (CA/Browser Forum Baseline
 * Requirements §7.1) is checked once a path is found. When no path is
 * accepted, the reason is that of the attempt that got nearest a root: one
 * that reached a root beats any that did not, a longer one a shorter, and the
 * first found a later one of the same length.
 *
 * Revocation (CRLs, OCSP, Certificate Transparency), certificate policies,
 * RFC 5280 §7.1's Name folding and an extension's criticality are not
 * checked; each is a finding of docs/security/crypto-pki.md. Nothing here is
 * secret — certificates, names and public keys — so nothing is wiped.
 *
 * Written for this module from RFC 5280 (§4.2 and §6.1), RFC 6125 (§6.4),
 * RFC 4291 §2.2 and RFC 3986 §3.2.2 (address literals), RFC 5758, RFC 8017
 * and RFC 4055 (the signature algorithms), RFC 8032 (Ed25519) and the
 * Baseline Requirements §7.1, and checked against x509-limbo
 * (tests/link/crypto_pki_limbo).
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */
import { ed25519Verify, ED25519_PUBLIC_KEY_SIZE } from "nish/crypto/ed25519"
import { p256Verify, P256_POINT_SIZE } from "nish/crypto/p256"
import { p384Verify, P384_POINT_SIZE } from "nish/crypto/p384"
import {
  RSA_HASH_SHA256,
  RSA_HASH_SHA384,
  RSA_HASH_SHA512,
  RsaPublicKey,
  rsaParsePublicKey,
  rsaVerifyPkcs1v15,
  rsaVerifyPss,
} from "nish/crypto/rsa"
import { sha256 } from "nish/crypto/sha256"
import { sha384 } from "nish/crypto/sha512"
import {
  X509Certificate,
  X509GeneralSubtree,
  X509_GN_DIR,
  X509_GN_DNS,
  X509_GN_IP,
  X509_KEY_ED25519,
  X509_KEY_P256,
  X509_KEY_P384,
  X509_KEY_RSA,
  X509_KU_DIGITAL_SIGNATURE,
  X509_KU_KEY_CERT_SIGN,
  X509_MAX_SERIAL,
  X509_SIG_ECDSA_SHA256,
  X509_SIG_ECDSA_SHA384,
  X509_SIG_ED25519,
  X509_SIG_RSA_PKCS1_SHA256,
  X509_SIG_RSA_PKCS1_SHA384,
  X509_SIG_RSA_PKCS1_SHA512,
  X509_SIG_RSA_PSS,
  x509DerSignatureRSWidth,
  x509NameEqual,
  x509NameIsPrefix,
  x509ParseCertificate,
} from "nish/crypto/x509"

/** The chain leads to a trusted root, every check passed and the leaf names the host. */
export const PKI_OK: i32 = 0
/**
 * The chain is empty, a certificate in it is not one `x509ParseCertificate`
 * reads, or a certificate on the path breaks the profile a server's chain
 * keeps: a key identifier, serial number or dNSName.
 */
export const PKI_ERR_MALFORMED: i32 = 1
/** A certificate's notAfter is before the instant given. */
export const PKI_ERR_EXPIRED: i32 = 2
/** A certificate's notBefore is after the instant given. */
export const PKI_ERR_NOT_YET_VALID: i32 = 3
/** No path leads to a root of the store. */
export const PKI_ERR_UNTRUSTED: i32 = 4
/** A signature does not verify under its issuer's key, or the key is not one. */
export const PKI_ERR_BAD_SIGNATURE: i32 = 5
/** An issuer is not a v3 certificate with basicConstraints cA, or the leaf is a CA. */
export const PKI_ERR_NOT_CA: i32 = 6
/** An issuer's pathLenConstraint is fewer than the intermediates below it. */
export const PKI_ERR_PATH_LENGTH: i32 = 7
/** An issuer's keyUsage lacks keyCertSign, or the leaf's lacks digitalSignature or has keyCertSign. */
export const PKI_ERR_KEY_USAGE: i32 = 8
/** An extKeyUsage lacks serverAuth, the leaf's allows any, or the root has one. */
export const PKI_ERR_EXT_KEY_USAGE: i32 = 9
/** A certificate carries a critical extension `nish/crypto/x509` does not decode. */
export const PKI_ERR_UNKNOWN_CRITICAL: i32 = 10
/** A name below an issuer is outside its nameConstraints, they are of a form not checked, or the leaf has some. */
export const PKI_ERR_NAME_CONSTRAINTS: i32 = 11
/** The leaf's subjectAltName does not name the host. */
export const PKI_ERR_HOSTNAME: i32 = 12
/** An RSA key is shorter than `PKI_MIN_RSA_BITS`, or its modulus is not a whole number of bytes. */
export const PKI_ERR_WEAK_KEY: i32 = 13
/** A signature algorithm is SHA-1, unknown, or not one the issuer's key makes, or the leaf's key is of no type offered. */
export const PKI_ERR_UNSUPPORTED_ALGORITHM: i32 = 14
/** The chain or a path is longer than its bound. */
export const PKI_ERR_CHAIN_TOO_LONG: i32 = 15
/** The chain asks for more work than one call does: signatures, names or subtrees. */
export const PKI_ERR_BUDGET: i32 = 16

/** The most certificates a chain may hold, the leaf among them. */
export const PKI_MAX_CHAIN_CERTS: i32 = 128
/** The most bytes a chain's certificates may total: 1 MiB. */
export const PKI_MAX_CHAIN_BYTES: i32 = 1048576
/** The most certificates in a path, the leaf and the root among them. */
export const PKI_MAX_PATH: i32 = 8
/** The most signatures one call checks. */
export const PKI_MAX_SIGNATURES: i32 = 64
/** The most subjectAltName dNSNames and iPAddresses together a certificate may carry. */
export const PKI_MAX_NAMES: i32 = 1024
/** The most permitted and excluded subtrees together a certificate may carry. */
export const PKI_MAX_SUBTREES: i32 = 256
/** The most name-against-subtree comparisons one call makes. */
export const PKI_MAX_NAME_CHECKS: i32 = 250000
/** The shortest RSA modulus accepted, in bits. */
export const PKI_MIN_RSA_BITS: i32 = 2048

/** What an attempt that reached a root adds to its length, so it outranks every one that did not. */
const PKI_AT_ROOT: i32 = 1000

/** The roots a program trusts, indexed by their subject Name. */
export class PkiTrustStore {
  /** Every root, in the order given, no two with the same DER. */
  roots: X509Certificate[]
  /** The roots under each subject, keyed by the subject's DER in hex. */
  bySubject: Map<string, X509Certificate[]>

  constructor() {
    this.roots = []
    this.bySubject = new Map<string, X509Certificate[]>()
  }
}

/** What `pkiVerifyServer` found. */
export class PkiResult {
  /** `PKI_OK` or a `PKI_ERR_` constant. */
  code: i32
  /** When `PKI_OK`, the path: the leaf first, the root last; otherwise empty. */
  path: X509Certificate[]

  constructor(code: i32, path: X509Certificate[]) {
    this.code = code
    this.path = path
  }
}

/** One call's search: the pool, the host, the path so far, and what has been spent. */
class PkiSearch {
  store: PkiTrustStore
  pool: X509Certificate[]
  path: X509Certificate[]
  /** The host as a DNS name, normalised, or `""` when it is an address. */
  host: string
  nowMs: i64 = 0
  signatures: i32 = 0
  nameChecks: i32 = 0
  /** The reason of the attempt nearest a root, and how near it got. */
  bestCode: i32 = 0
  bestScore: i32 = -1
  /** Whether a bound was spent, which ends the search. */
  spent: boolean = false

  constructor(store: PkiTrustStore, pool: X509Certificate[], host: string, nowMs: i64) {
    this.store = store
    this.pool = pool
    this.path = []
    this.host = host
    this.nowMs = nowMs
    this.bestCode = PKI_ERR_UNTRUSTED
  }
}

// ---------------------------------------------------------------------------
// Bytes and ASCII
// ---------------------------------------------------------------------------

const pkiBytesEqual = (a: u8[], b: u8[]): boolean => {
  const n: i32 = toI32(a.length)
  if (n !== toI32(b.length)) {
    return false
  }
  for (let i: i32 = 0; i < n && i < toI32(b.length); i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

const pkiHexDigits: string = "0123456789abcdef"

/** `bytes` in lower-case hex, a `Map` key. */
const pkiHex = (bytes: u8[]): string => {
  const out: u8[] = new Array<u8>(2 * toI32(bytes.length))
  for (let i: i32 = 0; i < toI32(bytes.length) && 2 * i + 1 < toI32(out.length); i++) {
    const b: i32 = toI32(bytes[i])
    out[2 * i] = toU8(toI32(pkiHexDigits.charCodeAt(b >> 4)))
    out[2 * i + 1] = toU8(toI32(pkiHexDigits.charCodeAt(b & 15)))
  }
  return String.fromBytes(out, 0, toI32(out.length))
}

const pkiLower = (c: i32): i32 => (c >= 65 && c <= 90 ? c + 32 : c)

/** Whether `a[aAt ..]` and `b[bAt ..]` agree for `n` bytes, ASCII case folded; both ranges must lie inside. */
const pkiFoldEqualAt = (a: string, aAt: i32, b: string, bAt: i32, n: i32): boolean => {
  if (aAt < 0 || bAt < 0 || n < 0 || aAt + n > toI32(a.length) || bAt + n > toI32(b.length)) {
    return false
  }
  for (let i: i32 = 0; i < n; i++) {
    if (pkiLower(toI32(a.charCodeAt(aAt + i))) !== pkiLower(toI32(b.charCodeAt(bAt + i)))) {
      return false
    }
  }
  return true
}

/** `s` without one trailing dot. */
const pkiStripDot = (s: string): string =>
  s.length > 0 && toI32(s.charCodeAt(toI32(s.length) - 1)) === 46 ? s.slice(0, toI32(s.length) - 1) : s

/**
 * Whether `s` is a DNS name a hostname can be: one to 253 bytes of labels of
 * one to 63 letters, digits, hyphens or underscores, joined by single dots,
 * with no trailing dot (a caller strips it). No `*`, no space, no octet past
 * ASCII.
 */
const pkiValidDns = (s: string): boolean => {
  const n: i32 = toI32(s.length)
  if (n === 0 || n > 253) {
    return false
  }
  let label: i32 = 0
  for (let i: i32 = 0; i < n; i++) {
    const c: i32 = toI32(s.charCodeAt(i))
    if (c === 46) {
      if (label === 0) {
        return false
      }
      label = 0
    } else if (
      (c >= 97 && c <= 122) ||
      (c >= 65 && c <= 90) ||
      (c >= 48 && c <= 57) ||
      c === 45 ||
      c === 95
    ) {
      label++
      if (label > 63) {
        return false
      }
    } else {
      return false
    }
  }
  return label > 0
}

const pkiLabelCount = (s: string): i32 => {
  let count: i32 = 1
  for (let i: i32 = 0; i < toI32(s.length); i++) {
    if (toI32(s.charCodeAt(i)) === 46) {
      count++
    }
  }
  return count
}

// ---------------------------------------------------------------------------
// Address literals (RFC 3986 §3.2.2, RFC 4291 §2.2)
// ---------------------------------------------------------------------------

const pkiDigit = (c: i32): i32 => (c >= 48 && c <= 57 ? c - 48 : -1)

const pkiHexDigit = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48
  }
  const l: i32 = pkiLower(c)
  return l >= 97 && l <= 102 ? l - 87 : -1
}

/**
 * The four octets of a dotted quad in `s[start .. end)`: four decimal numbers
 * of 0 to 255, with no sign and no leading zero, or `null`.
 */
const pkiParseIpv4 = (s: string, start: i32, end: i32): u8[] | null => {
  if (start < 0 || end > toI32(s.length)) {
    return null
  }
  const out: u8[] = new Array<u8>(4)
  let part: i32 = 0
  let value: i32 = 0
  let digits: i32 = 0
  for (let i: i32 = start; i <= end; i++) {
    const c: i32 = i < end ? toI32(s.charCodeAt(i)) : 46
    if (c === 46) {
      if (digits === 0 || part > 3) {
        return null
      }
      out[part] = toU8(value)
      part++
      value = 0
      digits = 0
    } else {
      const d: i32 = pkiDigit(c)
      if (d < 0 || (digits > 0 && value === 0)) {
        return null
      }
      value = value * 10 + d
      digits++
      if (value > 255) {
        return null
      }
    }
  }
  return part === 4 ? out : null
}

/**
 * The sixteen octets of an IPv6 address in `s` (RFC 4291 §2.2): eight groups
 * of one to four hex digits, at most one `::` standing for one or more zero
 * groups, and a dotted quad as the last two groups. A zone (`%eth0`) is not an
 * address. `null` for anything else.
 */
const pkiParseIpv6 = (s: string): u8[] | null => {
  const n: i32 = toI32(s.length)
  const words: i32[] = []
  let gap: i32 = -1
  let value: i32 = 0
  let digits: i32 = 0
  let colons: i32 = 0
  let group: i32 = 0
  let quadAt: i32 = -1
  for (let i: i32 = 0; i < n; i++) {
    const c: i32 = toI32(s.charCodeAt(i))
    if (c === 58) {
      if (digits > 0) {
        if (toI32(words.length) >= 8) {
          return null
        }
        words.push(value)
        value = 0
        digits = 0
      }
      colons++
      if (colons > 2 || (colons === 2 && gap >= 0)) {
        return null
      }
      if (colons === 2) {
        gap = toI32(words.length)
      }
    } else if (c === 46) {
      quadAt = group
      break
    } else {
      const d: i32 = pkiHexDigit(c)
      if (d < 0 || digits >= 4 || (colons === 1 && toI32(words.length) === 0 && gap < 0)) {
        return null
      }
      if (digits === 0) {
        group = i
      }
      colons = 0
      value = value * 16 + d
      digits++
    }
  }
  if (quadAt >= 0) {
    const quad: u8[] | null = pkiParseIpv4(s, quadAt, n)
    if (quad === null || toI32(words.length) > 6) {
      return null
    }
    words.push((toI32(quad[0]) << 8) | toI32(quad[1]))
    words.push((toI32(quad[2]) << 8) | toI32(quad[3]))
  } else if (digits > 0) {
    if (toI32(words.length) >= 8) {
      return null
    }
    words.push(value)
  } else if (colons !== 2) {
    return null
  }
  const count: i32 = toI32(words.length)
  if ((gap < 0 && count !== 8) || (gap >= 0 && count > 7)) {
    return null
  }
  const out: u8[] = new Array<u8>(16)
  for (let w: i32 = 0; w < count; w++) {
    const at: i32 = gap >= 0 && w >= gap ? w + 8 - count : w
    if (at >= 0 && 2 * at + 1 < 16) {
      out[2 * at] = toU8(words[w] >> 8)
      out[2 * at + 1] = toU8(words[w] & 255)
    }
  }
  return out
}

/**
 * The octets of `host` when it is an address: a dotted quad, or an IPv6
 * address bare or in brackets. `null` when it is not one — then it is a DNS
 * name or nothing, and a bracket or a colon is never part of a DNS name.
 */
const pkiParseIp = (host: string): u8[] | null => {
  const n: i32 = toI32(host.length)
  if (n >= 2 && toI32(host.charCodeAt(0)) === 91 && toI32(host.charCodeAt(n - 1)) === 93) {
    return pkiParseIpv6(host.slice(1, n - 1))
  }
  if (host.indexOf(":") >= 0) {
    return pkiParseIpv6(host)
  }
  return pkiParseIpv4(host, 0, n)
}

// ---------------------------------------------------------------------------
// Hostname (RFC 6125 §6.4)
// ---------------------------------------------------------------------------

/**
 * Whether the subjectAltName dNSName `san`, IA5 bytes as encoded, names
 * `host`, a valid DNS name without its trailing dot. A wildcard is only the
 * whole leftmost label, `*.` before two labels or more, and stands for
 * exactly one label of `host`.
 */
const pkiDnsMatch = (san: string, host: string): boolean => {
  const name: string = pkiStripDot(san)
  const n: i32 = toI32(name.length)
  if (n >= 2 && toI32(name.charCodeAt(0)) === 42 && toI32(name.charCodeAt(1)) === 46) {
    const rest: string = name.slice(2, n)
    const dot: i32 = toI32(host.indexOf("."))
    const restLength: i32 = n - 2
    return (
      pkiValidDns(rest) &&
      pkiLabelCount(rest) >= 2 &&
      dot > 0 &&
      toI32(host.length) - dot - 1 === restLength &&
      pkiFoldEqualAt(host, dot + 1, rest, 0, restLength)
    )
  }
  return pkiValidDns(name) && n === toI32(host.length) && pkiFoldEqualAt(name, 0, host, 0, n)
}

/** `hostname` without one trailing dot when it is a valid DNS name, else `null`. */
const pkiHostDns = (hostname: string): string | null => {
  const host: string = pkiStripDot(hostname)
  return pkiValidDns(host) ? host : null
}

/**
 * Whether `leaf` names `hostname` (RFC 6125 §6.4): an address against the
 * subjectAltName iPAddresses, octet for octet; any other name, ASCII and
 * compared without case after one trailing dot is stripped from each side,
 * against the dNSNames, a wildcard only as a whole leftmost label. The
 * subject's common name is never read, so a certificate without a
 * subjectAltName names no host.
 */
export const pkiMatchHostname = (leaf: X509Certificate, hostname: string): boolean => {
  const ip: u8[] | null = pkiParseIp(pkiStripDot(hostname))
  if (ip !== null) {
    for (const a of leaf.sanIp) {
      if (pkiBytesEqual(a, ip)) {
        return true
      }
    }
    return false
  }
  const host: string | null = pkiHostDns(hostname)
  if (host === null) {
    return false
  }
  for (const d of leaf.sanDns) {
    if (pkiDnsMatch(d, host)) {
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

/**
 * Whether an RSA key is fit to sign or serve, as a code: one
 * `rsaParsePublicKey` refused is a bad signature, and one shorter than
 * `PKI_MIN_RSA_BITS`, or whose modulus is not a whole number of bytes, a weak
 * key.
 */
const pkiRsaKeyCode = (key: RsaPublicKey | null): i32 => {
  if (key === null) {
    return PKI_ERR_BAD_SIGNATURE
  }
  return key.bits < PKI_MIN_RSA_BITS || key.bits % 8 !== 0 ? PKI_ERR_WEAK_KEY : PKI_OK
}

/**
 * An RSA signature of `cert` under `issuer`'s key, PKCS#1 v1.5 or PSS as
 * `cert.sigAlg` names. The key is checked by `pkiRsaKeyCode` first. `X509_HASH_` and
 * `RSA_HASH_` number SHA-256, SHA-384 and SHA-512 alike, so `pssHash` passes
 * straight through.
 */
const pkiRsaCode = (cert: X509Certificate, issuer: X509Certificate): i32 => {
  const key: RsaPublicKey | null = rsaParsePublicKey(issuer.publicKey)
  const fit: i32 = pkiRsaKeyCode(key)
  if (key === null || fit !== PKI_OK) {
    return fit
  }
  const alg: i32 = cert.sigAlg
  if (alg === X509_SIG_RSA_PSS) {
    return rsaVerifyPss(key, cert.pssHash, cert.pssSaltLen, cert.tbs, cert.signature)
      ? PKI_OK
      : PKI_ERR_BAD_SIGNATURE
  }
  let hash: i32 = RSA_HASH_SHA512
  if (alg === X509_SIG_RSA_PKCS1_SHA256) {
    hash = RSA_HASH_SHA256
  } else if (alg === X509_SIG_RSA_PKCS1_SHA384) {
    hash = RSA_HASH_SHA384
  }
  return rsaVerifyPkcs1v15(key, hash, cert.tbs, cert.signature) ? PKI_OK : PKI_ERR_BAD_SIGNATURE
}

/** An ECDSA signature of `cert` under a P-256 or P-384 key, with SHA-256 or SHA-384 as `cert.sigAlg` names. */
const pkiEcdsaCode = (cert: X509Certificate, issuer: X509Certificate): i32 => {
  const digest: u8[] = cert.sigAlg === X509_SIG_ECDSA_SHA256 ? sha256(cert.tbs) : sha384(cert.tbs)
  if (issuer.keyType === X509_KEY_P256) {
    const rs: u8[] | null = x509DerSignatureRSWidth(cert.signature, 32)
    return toI32(issuer.publicKey.length) === P256_POINT_SIZE &&
      rs !== null &&
      p256Verify(issuer.publicKey, digest, rs)
      ? PKI_OK
      : PKI_ERR_BAD_SIGNATURE
  }
  const rs: u8[] | null = x509DerSignatureRSWidth(cert.signature, 48)
  return toI32(issuer.publicKey.length) === P384_POINT_SIZE &&
    rs !== null &&
    p384Verify(issuer.publicKey, digest, rs)
    ? PKI_OK
    : PKI_ERR_BAD_SIGNATURE
}

/**
 * Whether `cert`'s signature verifies under `issuer`'s key, as a code: `PKI_OK`,
 * `PKI_ERR_BAD_SIGNATURE`, `PKI_ERR_WEAK_KEY`, or `PKI_ERR_UNSUPPORTED_ALGORITHM`
 * for SHA-1, an unknown algorithm, or one the key does not make.
 */
const pkiSignatureCode = (cert: X509Certificate, issuer: X509Certificate): i32 => {
  const alg: i32 = cert.sigAlg
  const key: i32 = issuer.keyType
  if (alg === X509_SIG_ECDSA_SHA256 || alg === X509_SIG_ECDSA_SHA384) {
    return key === X509_KEY_P256 || key === X509_KEY_P384
      ? pkiEcdsaCode(cert, issuer)
      : PKI_ERR_UNSUPPORTED_ALGORITHM
  }
  if (alg === X509_SIG_ED25519) {
    if (key !== X509_KEY_ED25519) {
      return PKI_ERR_UNSUPPORTED_ALGORITHM
    }
    return toI32(issuer.publicKey.length) === ED25519_PUBLIC_KEY_SIZE &&
      ed25519Verify(issuer.publicKey, cert.tbs, cert.signature)
      ? PKI_OK
      : PKI_ERR_BAD_SIGNATURE
  }
  if (
    alg === X509_SIG_RSA_PKCS1_SHA256 ||
    alg === X509_SIG_RSA_PKCS1_SHA384 ||
    alg === X509_SIG_RSA_PKCS1_SHA512 ||
    alg === X509_SIG_RSA_PSS
  ) {
    return key === X509_KEY_RSA ? pkiRsaCode(cert, issuer) : PKI_ERR_UNSUPPORTED_ALGORITHM
  }
  return PKI_ERR_UNSUPPORTED_ALGORITHM
}

/**
 * Whether `cert`'s signature verifies under `issuer`'s key: ECDSA with SHA-256
 * or SHA-384 under P-256 or P-384, RSA PKCS#1 v1.5 with SHA-256, SHA-384 or
 * SHA-512 and RSASSA-PSS under a key of `PKI_MIN_RSA_BITS` or more whose
 * modulus is a whole number of bytes, and Ed25519. Nothing else about either certificate is checked.
 */
export const pkiVerifySignature = (cert: X509Certificate, issuer: X509Certificate): boolean =>
  pkiSignatureCode(cert, issuer) === PKI_OK

/** `pkiSignatureCode` within the call's budget of signatures. */
const pkiCheckSignature = (s: PkiSearch, cert: X509Certificate, issuer: X509Certificate): i32 => {
  if (s.signatures >= PKI_MAX_SIGNATURES) {
    s.spent = true
    return PKI_ERR_BUDGET
  }
  s.signatures = s.signatures + 1
  return pkiSignatureCode(cert, issuer)
}

// ---------------------------------------------------------------------------
// Name constraints (RFC 5280 §4.2.1.10, §6.1.3 (b) and (c))
// ---------------------------------------------------------------------------

/**
 * Whether the DNS name `name` lies in the subtree `base`, without case: `""`
 * is every name, `.example.com` every name below example.com, and
 * `example.com` it and every name below it.
 */
const pkiDnsWithin = (name: string, base: string): boolean => {
  const b: string = pkiStripDot(base)
  const nb: i32 = toI32(b.length)
  const nn: i32 = toI32(name.length)
  if (nb === 0) {
    return true
  }
  if (toI32(b.charCodeAt(0)) === 46) {
    return nn > nb && pkiFoldEqualAt(name, nn - nb, b, 0, nb)
  }
  if (nn === nb) {
    return pkiFoldEqualAt(name, 0, b, 0, nb)
  }
  return nn > nb && toI32(name.charCodeAt(nn - nb - 1)) === 46 && pkiFoldEqualAt(name, nn - nb, b, 0, nb)
}

/** `base` as the name its subtree is rooted at: without its leading dot. */
const pkiSubtreeRoot = (base: string): string =>
  base.length > 0 && toI32(base.charCodeAt(0)) === 46 ? base.slice(1, toI32(base.length)) : base

/**
 * Whether `issuer`'s dNSName constraints allow the name `dns`: inside one
 * permitted subtree when any is listed, and in no excluded one. A wildcard
 * `*.X` stands for every name one label below X, so it is permitted when X
 * lies in the subtree's root, and excluded when it could reach an excluded
 * subtree — X lies in that root, or the root lies below X.
 */
const pkiDnsAllowed = (issuer: X509Certificate, dns: string): boolean => {
  const name: string = pkiStripDot(dns)
  const wildcard: boolean = name.startsWith("*.")
  const base: string = wildcard ? name.slice(2, toI32(name.length)) : name
  let listed: boolean = false
  let inside: boolean = false
  for (const p of issuer.ncPermitted) {
    if (p.kind === X509_GN_DNS) {
      listed = true
      if (wildcard ? pkiDnsWithin(base, pkiSubtreeRoot(p.dns)) : pkiDnsWithin(base, p.dns)) {
        inside = true
      }
    }
  }
  if (listed && !inside) {
    return false
  }
  for (const e of issuer.ncExcluded) {
    if (e.kind === X509_GN_DNS) {
      const root: string = pkiSubtreeRoot(e.dns)
      if (wildcard ? pkiDnsWithin(base, root) || pkiDnsWithin(root, base) : pkiDnsWithin(base, e.dns)) {
        return false
      }
    }
  }
  return true
}

/** Whether `ip` lies in the iPAddress subtree `t`: the same family, and equal under its mask. */
const pkiIpWithin = (ip: u8[], t: X509GeneralSubtree): boolean => {
  const n: i32 = toI32(ip.length)
  if (n !== toI32(t.ip.length) || n !== toI32(t.mask.length)) {
    return false
  }
  for (let k: i32 = 0; k < n && k < toI32(t.ip.length) && k < toI32(t.mask.length); k++) {
    if ((toI32(ip[k]) & toI32(t.mask[k])) !== (toI32(t.ip[k]) & toI32(t.mask[k]))) {
      return false
    }
  }
  return true
}

/** Whether `issuer`'s iPAddress constraints allow `ip`; a subtree of the other family never holds it. */
const pkiIpAllowed = (issuer: X509Certificate, ip: u8[]): boolean => {
  let listed: boolean = false
  let inside: boolean = false
  for (const p of issuer.ncPermitted) {
    if (p.kind === X509_GN_IP) {
      listed = true
      if (pkiIpWithin(ip, p)) {
        inside = true
      }
    }
  }
  if (listed && !inside) {
    return false
  }
  for (const e of issuer.ncExcluded) {
    if (e.kind === X509_GN_IP && pkiIpWithin(ip, e)) {
      return false
    }
  }
  return true
}

/**
 * Whether `issuer`'s permitted directoryName constraints allow the subject
 * Name `subject`: one of them is a prefix of it, RDN by RDN. An empty subject
 * names nothing and is allowed. Excluded directoryNames never reach here: a
 * byte-exact prefix test would let a differently spelt Name past one, so a
 * chain that carries any is refused whole.
 */
const pkiDirAllowed = (issuer: X509Certificate, subject: u8[]): boolean => {
  if (toI32(subject.length) <= 2) {
    return true
  }
  let listed: boolean = false
  for (const p of issuer.ncPermitted) {
    if (p.kind === X509_GN_DIR) {
      listed = true
      if (x509NameIsPrefix(p.dirName, subject)) {
        return true
      }
    }
  }
  return !listed
}

const pkiSelfIssued = (c: X509Certificate): boolean => x509NameEqual(c.subject, c.issuer)

/**
 * Whether `issuer`'s nameConstraints allow every name below it in the path
 * and the host, as a code. Each issuer's constraints are checked on their
 * own, which makes permitted subtrees an intersection down the path and
 * excluded ones a union.
 */
const pkiConstraintsCode = (s: PkiSearch, issuer: X509Certificate): i32 => {
  if (!issuer.ncPresent) {
    return PKI_OK
  }
  if (issuer.ncUnsupported) {
    return PKI_ERR_NAME_CONSTRAINTS
  }
  for (const e of issuer.ncExcluded) {
    if (e.kind === X509_GN_DIR) {
      return PKI_ERR_NAME_CONSTRAINTS
    }
  }
  let names: i32 = 1
  for (const c of s.path) {
    names = names + toI32(c.sanDns.length) + toI32(c.sanIp.length) + 1
  }
  const cost: i32 = names * (toI32(issuer.ncPermitted.length) + toI32(issuer.ncExcluded.length))
  if (cost > PKI_MAX_NAME_CHECKS - s.nameChecks) {
    s.spent = true
    return PKI_ERR_BUDGET
  }
  s.nameChecks = s.nameChecks + cost
  if (s.host.length > 0 && !pkiDnsAllowed(issuer, s.host)) {
    return PKI_ERR_NAME_CONSTRAINTS
  }
  for (let i: i32 = 0; i < toI32(s.path.length); i++) {
    const c: X509Certificate = s.path[i]
    for (const d of c.sanDns) {
      if (!pkiDnsAllowed(issuer, d)) {
        return PKI_ERR_NAME_CONSTRAINTS
      }
    }
    for (const ip of c.sanIp) {
      if (!pkiIpAllowed(issuer, ip)) {
        return PKI_ERR_NAME_CONSTRAINTS
      }
    }
    if ((i === 0 || !pkiSelfIssued(c)) && !pkiDirAllowed(issuer, c.subject)) {
      return PKI_ERR_NAME_CONSTRAINTS
    }
  }
  return PKI_OK
}

// ---------------------------------------------------------------------------
// The path (RFC 5280 §6.1)
// ---------------------------------------------------------------------------

/** Whether `c` is valid at `nowMs`, as a code. */
const pkiTimeCode = (c: X509Certificate, nowMs: i64): i32 => {
  if (nowMs < c.notBefore) {
    return PKI_ERR_NOT_YET_VALID
  }
  return nowMs > c.notAfter ? PKI_ERR_EXPIRED : PKI_OK
}

/**
 * The key identifiers an issuer `cand` must carry (RFC 5280 §4.2.1.1 and
 * §4.2.1.2), as a code: a subjectKeyIdentifier, which a root may lack, as
 * one Mozilla ships does, and an authorityKeyIdentifier unless it is
 * self-issued, even on a root. A self-issued root's authorityKeyIdentifier,
 * when present, is its own subjectKeyIdentifier.
 */
const pkiKeyIdsCode = (cand: X509Certificate, root: boolean): i32 => {
  const skid: u8[] | null = cand.skid
  const akid: u8[] | null = cand.akid
  if (skid === null) {
    return root ? PKI_OK : PKI_ERR_MALFORMED
  }
  if (!pkiSelfIssued(cand)) {
    return akid === null ? PKI_ERR_MALFORMED : PKI_OK
  }
  return root && akid !== null && !pkiBytesEqual(akid, skid) ? PKI_ERR_MALFORMED : PKI_OK
}

/**
 * The checks of the issuer `cand` added above the path, a root of the store
 * when `root` holds and an intermediate otherwise: its validity, its critical
 * extensions, that it is a CA, its extKeyUsage, its name constraints, its
 * signature over `child` — the only check that costs — and, once that
 * verifies, its key identifiers, so a wrong key reads as a signature. An
 * intermediate also needs room for a root above it and a keyUsage that
 * allows keyCertSign; every issuer, the root too, needs a pathLenConstraint
 * that covers the intermediates below it. A root's keyUsage is not read, and
 * it may carry no extKeyUsage at all.
 */
const pkiIssuerCode = (s: PkiSearch, child: X509Certificate, cand: X509Certificate, root: boolean): i32 => {
  // No intermediate is added past PKI_MAX_PATH - 1, so a root always fits.
  if (!root && toI32(s.path.length) + 2 > PKI_MAX_PATH) {
    return PKI_ERR_CHAIN_TOO_LONG
  }
  const time: i32 = pkiTimeCode(cand, s.nowMs)
  if (time !== PKI_OK) {
    return time
  }
  if (cand.unknownCritical) {
    return PKI_ERR_UNKNOWN_CRITICAL
  }
  if (cand.version !== 2 || !cand.bcPresent || !cand.bcCa) {
    return PKI_ERR_NOT_CA
  }
  if (!root && cand.keyUsage >= 0 && (cand.keyUsage & X509_KU_KEY_CERT_SIGN) === 0) {
    return PKI_ERR_KEY_USAGE
  }
  if (cand.ekuPresent && (root || (!cand.ekuServerAuth && !cand.ekuAny))) {
    return PKI_ERR_EXT_KEY_USAGE
  }
  if (cand.bcPathLen >= 0) {
    let below: i32 = 0
    for (let i: i32 = 1; i < toI32(s.path.length); i++) {
      if (!pkiSelfIssued(s.path[i])) {
        below++
      }
    }
    if (below > cand.bcPathLen) {
      return PKI_ERR_PATH_LENGTH
    }
  }
  const names: i32 = pkiConstraintsCode(s, cand)
  if (names !== PKI_OK) {
    return names
  }
  const signature: i32 = pkiCheckSignature(s, child, cand)
  return signature !== PKI_OK ? signature : pkiKeyIdsCode(cand, root)
}

/** Keeps `code` as the answer when its attempt, `score` long, got nearer a root than any before it. */
const pkiNote = (s: PkiSearch, code: i32, score: i32): void => {
  if (score > s.bestScore) {
    s.bestScore = score
    s.bestCode = code
  }
}

/**
 * Whether `cand` may be tried as `child`'s issuer: its key identifier is not
 * another than the one `child` names, and it is not already in the path.
 */
const pkiCandidate = (s: PkiSearch, child: X509Certificate, cand: X509Certificate): boolean => {
  const akid: u8[] | null = child.akid
  const skid: u8[] | null = cand.skid
  if (akid !== null && skid !== null && !pkiBytesEqual(akid, skid)) {
    return false
  }
  for (const c of s.path) {
    if (pkiBytesEqual(c.der, cand.der)) {
      return false
    }
  }
  return true
}

/**
 * Extends the path above `child`, its last certificate, toward a root: the
 * store's roots under `child`'s issuer first, then the pool's certificates in
 * the order sent. Answers whether a path was accepted, then whole in `s.path`.
 */
const pkiExtend = (s: PkiSearch, child: X509Certificate): boolean => {
  const depth: i32 = toI32(s.path.length)
  if (toI32(child.issuer.length) > 2) {
    const roots: X509Certificate[] | undefined = s.store.bySubject.get(pkiHex(child.issuer))
    if (roots !== undefined) {
      for (const root of roots) {
        if (pkiCandidate(s, child, root)) {
          const code: i32 = pkiIssuerCode(s, child, root, true)
          if (s.spent) {
            return false
          }
          if (code === PKI_OK) {
            s.path.push(root)
            return true
          }
          pkiNote(s, code, PKI_AT_ROOT + depth + 1)
        }
      }
    }
    for (const cand of s.pool) {
      if (x509NameEqual(cand.subject, child.issuer) && pkiCandidate(s, child, cand)) {
        const code: i32 = pkiIssuerCode(s, child, cand, false)
        if (s.spent) {
          return false
        }
        if (code !== PKI_OK) {
          pkiNote(s, code, depth + 1)
        } else {
          s.path.push(cand)
          if (pkiExtend(s, cand)) {
            return true
          }
          if (s.spent) {
            return false
          }
          s.path.pop()
        }
      }
    }
  }
  pkiNote(s, PKI_ERR_UNTRUSTED, depth)
  return false
}

// ---------------------------------------------------------------------------
// The leaf's profile (CA/Browser Forum Baseline Requirements §7.1)
// ---------------------------------------------------------------------------

/** Whether `c`'s serial number is 1 to 20 octets and not zero (RFC 5280 §4.1.2.2). */
const pkiSerialSound = (c: X509Certificate): boolean => {
  const n: i32 = toI32(c.serial.length)
  if (n < 1 || n > X509_MAX_SERIAL) {
    return false
  }
  for (let i: i32 = 0; i < n; i++) {
    if (c.serial[i] !== 0) {
      return true
    }
  }
  return false
}

/**
 * Whether the dNSName `san` is one a server's certificate may carry: a valid
 * DNS name of letters, digits and hyphens, after one trailing dot, or `*.`
 * before one.
 */
const pkiSanDnsSound = (san: string): boolean => {
  const name: string = pkiStripDot(san)
  const n: i32 = toI32(name.length)
  const wild: boolean = n >= 2 && toI32(name.charCodeAt(0)) === 42 && toI32(name.charCodeAt(1)) === 46
  return name.indexOf("_") < 0 && pkiValidDns(wild ? name.slice(2, n) : name)
}

/**
 * Whether the leaf's own key is one a server may hold, as a code: RSA of
 * `PKI_MIN_RSA_BITS` or more in whole bytes, P-256, P-384 or Ed25519, the keys
 * a signature is verified under here, so the server can prove it holds it.
 */
const pkiSubscriberKeyCode = (leaf: X509Certificate): i32 => {
  const type: i32 = leaf.keyType
  if (type === X509_KEY_RSA) {
    return pkiRsaKeyCode(rsaParsePublicKey(leaf.publicKey))
  }
  return type === X509_KEY_P256 || type === X509_KEY_P384 || type === X509_KEY_ED25519
    ? PKI_OK
    : PKI_ERR_UNSUPPORTED_ALGORITHM
}

/**
 * The checks of the leaf's profile, once a path above it is found: no keyCertSign
 * and no nameConstraints, no `anyExtendedKeyUsage`, a key a server may
 * hold, a sound serial number, an authorityKeyIdentifier unless it is
 * self-issued, and dNSNames of letters, digits and hyphens. The common name
 * is not read: limbo's own passing cases carry ones their subjectAltName
 * lacks.
 */
const pkiLeafProfileCode = (leaf: X509Certificate): i32 => {
  if (leaf.keyUsage >= 0 && (leaf.keyUsage & X509_KU_KEY_CERT_SIGN) !== 0) {
    return PKI_ERR_KEY_USAGE
  }
  if (leaf.ncPresent) {
    return PKI_ERR_NAME_CONSTRAINTS
  }
  if (leaf.ekuAny) {
    return PKI_ERR_EXT_KEY_USAGE
  }
  const key: i32 = pkiSubscriberKeyCode(leaf)
  if (key !== PKI_OK) {
    return key
  }
  if (!pkiSerialSound(leaf) || (leaf.akid === null && !pkiSelfIssued(leaf))) {
    return PKI_ERR_MALFORMED
  }
  for (const d of leaf.sanDns) {
    if (!pkiSanDnsSound(d)) {
      return PKI_ERR_MALFORMED
    }
  }
  return PKI_OK
}

/**
 * The checks of the leaf alone: its validity, its critical extensions, that
 * it is not a CA, that its key may sign a TLS handshake and is meant for a
 * server, and that it names the host. Its profile is judged after the path
 * search, so a path's reason comes first.
 */
const pkiLeafCode = (leaf: X509Certificate, hostname: string, nowMs: i64): i32 => {
  const time: i32 = pkiTimeCode(leaf, nowMs)
  if (time !== PKI_OK) {
    return time
  }
  if (leaf.unknownCritical) {
    return PKI_ERR_UNKNOWN_CRITICAL
  }
  if (leaf.bcCa) {
    return PKI_ERR_NOT_CA
  }
  if (leaf.keyUsage >= 0 && (leaf.keyUsage & X509_KU_DIGITAL_SIGNATURE) === 0) {
    return PKI_ERR_KEY_USAGE
  }
  if (leaf.ekuPresent && !leaf.ekuServerAuth) {
    return PKI_ERR_EXT_KEY_USAGE
  }
  return pkiMatchHostname(leaf, hostname) ? PKI_OK : PKI_ERR_HOSTNAME
}

/** A store of `roots`, indexed by subject; a root whose DER is one already given is kept once. */
export const pkiTrustStore = (roots: X509Certificate[]): PkiTrustStore => {
  const store = new PkiTrustStore()
  for (const root of roots) {
    const key: string = pkiHex(root.subject)
    const list: X509Certificate[] | undefined = store.bySubject.get(key)
    if (list === undefined) {
      const fresh: X509Certificate[] = [root]
      store.bySubject.set(key, fresh)
      store.roots.push(root)
    } else {
      let seen: boolean = false
      for (const r of list) {
        if (pkiBytesEqual(r.der, root.der)) {
          seen = true
        }
      }
      if (!seen) {
        list.push(root)
        store.roots.push(root)
      }
    }
  }
  return store
}

/**
 * Verifies a TLS server's chain: `chain` holds each certificate's DER as the
 * server sent it, the leaf first; `hostname` is the name or address dialled,
 * ASCII (an internationalised name in its A-label form); `nowMs` is the
 * instant to judge validity at, milliseconds since 1970-01-01 UTC; `store`
 * holds the roots trusted. `PKI_OK` with the path, or the reason it was
 * refused — see the module's header for which reason when several apply.
 */
export const pkiVerifyServer = (
  chain: u8[][],
  hostname: string,
  nowMs: i64,
  store: PkiTrustStore
): PkiResult => {
  const none: X509Certificate[] = []
  const count: i32 = toI32(chain.length)
  if (count === 0) {
    return new PkiResult(PKI_ERR_MALFORMED, none)
  }
  if (count > PKI_MAX_CHAIN_CERTS) {
    return new PkiResult(PKI_ERR_CHAIN_TOO_LONG, none)
  }
  let bytes: i32 = 0
  for (const der of chain) {
    bytes = bytes + toI32(der.length)
    if (bytes > PKI_MAX_CHAIN_BYTES) {
      return new PkiResult(PKI_ERR_CHAIN_TOO_LONG, none)
    }
  }
  const certs: X509Certificate[] = []
  for (const der of chain) {
    const c: X509Certificate | null = x509ParseCertificate(der)
    if (c === null) {
      return new PkiResult(PKI_ERR_MALFORMED, none)
    }
    if (
      toI32(c.sanDns.length) + toI32(c.sanIp.length) > PKI_MAX_NAMES ||
      toI32(c.ncPermitted.length) + toI32(c.ncExcluded.length) > PKI_MAX_SUBTREES
    ) {
      return new PkiResult(PKI_ERR_BUDGET, none)
    }
    certs.push(c)
  }
  const leaf: X509Certificate = certs[0]
  const leafCode: i32 = pkiLeafCode(leaf, hostname, nowMs)
  if (leafCode !== PKI_OK) {
    return new PkiResult(leafCode, none)
  }
  const pool: X509Certificate[] = []
  for (let i: i32 = 1; i < toI32(certs.length); i++) {
    pool.push(certs[i])
  }
  const ip: u8[] | null = pkiParseIp(pkiStripDot(hostname))
  const dns: string | null = ip === null ? pkiHostDns(hostname) : null
  const s = new PkiSearch(store, pool, dns === null ? "" : dns, nowMs)
  s.path.push(leaf)
  if (pkiExtend(s, leaf)) {
    const profile: i32 = pkiLeafProfileCode(leaf)
    return profile === PKI_OK ? new PkiResult(PKI_OK, s.path) : new PkiResult(profile, none)
  }
  return new PkiResult(s.spent ? PKI_ERR_BUDGET : s.bestCode, none)
}

/** A sentence for `code`, for a log or an error message. */
export const pkiReason = (code: i32): string => {
  if (code === PKI_OK) {
    return "the chain is trusted and names the host"
  }
  if (code === PKI_ERR_MALFORMED) {
    return "the chain is empty, or holds a certificate that does not parse or breaks the server profile"
  }
  if (code === PKI_ERR_EXPIRED) {
    return "a certificate has expired"
  }
  if (code === PKI_ERR_NOT_YET_VALID) {
    return "a certificate is not yet valid"
  }
  if (code === PKI_ERR_UNTRUSTED) {
    return "no path leads to a trusted root"
  }
  if (code === PKI_ERR_BAD_SIGNATURE) {
    return "a signature does not verify under its issuer's key"
  }
  if (code === PKI_ERR_NOT_CA) {
    return "an issuer is not a CA certificate, or the leaf is one"
  }
  if (code === PKI_ERR_PATH_LENGTH) {
    return "an issuer's path length constraint is exceeded"
  }
  if (code === PKI_ERR_KEY_USAGE) {
    return "a key usage does not allow its use here"
  }
  if (code === PKI_ERR_EXT_KEY_USAGE) {
    return "an extended key usage does not allow TLS server authentication"
  }
  if (code === PKI_ERR_UNKNOWN_CRITICAL) {
    return "a certificate has a critical extension that is not understood"
  }
  if (code === PKI_ERR_NAME_CONSTRAINTS) {
    return "a name is outside an issuer's name constraints"
  }
  if (code === PKI_ERR_HOSTNAME) {
    return "the certificate does not name the host"
  }
  if (code === PKI_ERR_WEAK_KEY) {
    return "an RSA key is shorter than 2048 bits or not a whole number of bytes"
  }
  if (code === PKI_ERR_UNSUPPORTED_ALGORITHM) {
    return "a signature algorithm is not supported"
  }
  if (code === PKI_ERR_CHAIN_TOO_LONG) {
    return "the chain or its path is too long"
  }
  if (code === PKI_ERR_BUDGET) {
    return "the chain asks for more work than one verification does"
  }
  return "unknown reason"
}

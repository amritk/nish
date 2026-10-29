/**
 * `nish/crypto/x509-path` — whether a server's certificate chain is one a
 * client may trust for a host: RFC 5280 §6 path validation from the leaf to a
 * trust anchor, RFC 6125 hostname verification against the leaf's
 * subjectAltName, and the operating system's trust store to anchor it in.
 *
 *     import { x509SystemTrustStore, x509ValidatePath, x509PathReason, X509_PATH_OK } from "nish/crypto/x509-path";
 *
 *     const trust: X509TrustStore | null = x509SystemTrustStore();
 *     // chain: the DER certificates of a TLS Certificate message, leaf first.
 *     if (trust !== null) {
 *       const code: i32 = x509ValidatePath(chain, trust, "example.com", toI64(Date.now()) / 1000);
 *       if (code !== X509_PATH_OK) {
 *         console.log(x509PathReason(code));
 *       }
 *     }
 *
 * Written for this module from RFC 5280 (§4.2's extensions and §6's
 * algorithm) and RFC 6125 (§6.4's DNS-ID matching, §6.4.3's wildcard).
 *
 * **What it decides.** `x509ValidatePath` answers `X509_PATH_OK` only when
 * every certificate parses (`nish/crypto/x509`), every certificate it reaches
 * has well-formed extensions and no critical extension it does not read, and
 * is inside its validity at `nowSeconds`; the leaf's extKeyUsage, if present,
 * allows serverAuth and its keyUsage, if present, digitalSignature; `host` is
 * one of the leaf's subjectAltName entries; and each certificate is signed by
 * the next — whose subject is its issuer by bytes, which is a v3 CA by
 * basicConstraints, whose keyUsage has keyCertSign, whose pathLenConstraint
 * the certificates below it fit, and whose nameConstraints the leaf's names
 * and `host` satisfy — until one is signed by a trust anchor. The first
 * failure is the answer, as one of the `X509_PATH_*` codes.
 *
 * **What it does not.** No revocation (CRL, OCSP, stapling), no certificate
 * transparency, no policy processing (§6.1.3's policy tree; certificatePolicies
 * and policyConstraints are read only enough to refuse one marked critical).
 * The chain is taken in the order sent, with no reordering and no fetching of
 * missing intermediates; an extra certificate after the one a trust anchor
 * signs is never looked at. A trust anchor is a name and a key: its own
 * validity, basicConstraints and keyUsage are not checked (RFC 5280 §6.1.1
 * (d)), while its nameConstraints are. A host is matched against
 * subjectAltName only, never the subject's common name (RFC 6125 §6.4.4 and
 * the CA/Browser Forum's requirement that a public certificate carry one).
 * The deviations from RFC 5280 are each stricter and listed in
 * docs/security/crypto-x509.md.
 *
 * **Algorithms.** A signature is checked when it is ecdsa-with-SHA256 under a
 * P-256 key; any other pairing of algorithm and key this module names answers
 * `X509_PATH_UNSUPPORTED_ALGORITHM`, and an ECDSA signature under an RSA key
 * (or the reverse) `X509_PATH_BAD_SIGNATURE`.
 *
 * Private names carry the `x509` prefix because a `std/` module's private
 * functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */
import { readFileSyncOrNull } from "nish:fs"
import { p256VerifySha256 } from "nish/crypto/p256"
import {
  X509Certificate,
  X509_KEY_OTHER,
  X509_KEY_P256,
  X509_KEY_P384,
  X509_KEY_RSA,
  X509_KU_DIGITAL_SIGNATURE,
  X509_KU_KEY_CERT_SIGN,
  X509_SIG_ECDSA_SHA256,
  X509_SIG_ECDSA_SHA384,
  X509_SIG_OTHER,
  pemToDer,
  x509DerSignatureRS,
  x509ParseCertificate,
} from "nish/crypto/x509"

/** The path is valid for the host at the time given. */
export const X509_PATH_OK: i32 = 0
/** The chain holds no certificate. */
export const X509_PATH_EMPTY: i32 = 1
/** The chain holds more than `X509_PATH_MAX_CHAIN` certificates. */
export const X509_PATH_TOO_LONG: i32 = 2
/** A certificate is not one `x509ParseCertificate` accepts. */
export const X509_PATH_MALFORMED: i32 = 3
/** A certificate's extensions are not well-formed DER of their grammar. */
export const X509_PATH_MALFORMED_EXTENSION: i32 = 4
/** A certificate carries a critical extension this module does not read. */
export const X509_PATH_UNKNOWN_CRITICAL_EXTENSION: i32 = 5
/** A certificate's notAfter is before the time given. */
export const X509_PATH_EXPIRED: i32 = 6
/** A certificate's notBefore is after the time given. */
export const X509_PATH_NOT_YET_VALID: i32 = 7
/** The host is not among the leaf's subjectAltName entries. */
export const X509_PATH_HOSTNAME_MISMATCH: i32 = 8
/** The leaf's extKeyUsage allows neither serverAuth nor any purpose. */
export const X509_PATH_LEAF_EKU: i32 = 9
/** The leaf's keyUsage lacks digitalSignature. */
export const X509_PATH_LEAF_KEY_USAGE: i32 = 10
/** An issuing certificate is not a v3 CA by basicConstraints. */
export const X509_PATH_NOT_CA: i32 = 11
/** More CA certificates follow an issuer than its pathLenConstraint allows. */
export const X509_PATH_PATH_LEN_EXCEEDED: i32 = 12
/** An issuing certificate's keyUsage is absent or lacks keyCertSign. */
export const X509_PATH_NO_KEY_CERT_SIGN: i32 = 13
/** A certificate's issuer is not the next certificate's subject. */
export const X509_PATH_ISSUER_MISMATCH: i32 = 14
/** A signature does not verify under its issuer's key. */
export const X509_PATH_BAD_SIGNATURE: i32 = 15
/** A signature's algorithm and its issuer's key are not a pair this module checks. */
export const X509_PATH_UNSUPPORTED_ALGORITHM: i32 = 16
/** No trust anchor signs any certificate in the chain. */
export const X509_PATH_UNTRUSTED_ROOT: i32 = 17
/** A name of the leaf, or the host, is outside an issuer's nameConstraints. */
export const X509_PATH_NAME_CONSTRAINTS: i32 = 18
/** An issuer's nameConstraints names a form this module cannot check. */
export const X509_PATH_UNSUPPORTED_NAME_CONSTRAINT: i32 = 19

/** The most certificates a chain may hold, leaf included. */
export const X509_PATH_MAX_CHAIN: i32 = 8

/** The bundles `x509SystemTrustStore` tries, in order: Debian and Alpine, Fedora and RHEL, then macOS and the BSDs. */
const x509SystemBundles = (): string[] => [
  "/etc/ssl/certs/ca-certificates.crt",
  "/etc/pki/tls/certs/ca-bundle.crt",
  "/etc/ssl/cert.pem",
]

/**
 * The certificates a path may end at. A trust anchor is the name and key of
 * one of `anchors`; nothing else about it is checked but its nameConstraints.
 */
export class X509TrustStore {
  /** Each anchor, parsed. */
  anchors: X509Certificate[]
  /** How many `CERTIFICATE` blocks were not read: bad PEM, or a certificate `x509ParseCertificate` refuses. */
  skipped: i32 = 0

  constructor() {
    this.anchors = []
  }
}

/** The one CERTIFICATE block `text` holds, parsed, or `null`. */
const x509PathBlock = (text: string): X509Certificate | null => {
  const blocks: u8[][] | null = pemToDer(text, "CERTIFICATE")
  return blocks !== null && toI32(blocks.length) === 1 ? x509ParseCertificate(blocks[0]) : null
}

/**
 * A trust store of each `-----BEGIN CERTIFICATE-----` block in `pem`, or
 * `null` when none is read. Each block is decoded and parsed alone, so one a
 * bundle holds in a form `nish/crypto/x509` refuses is counted in `skipped`
 * rather than losing the others; text outside the blocks is ignored.
 */
export const x509TrustStoreFromPem = (pem: string): X509TrustStore | null => {
  const begin: string = "-----BEGIN CERTIFICATE-----"
  const end: string = "-----END CERTIFICATE-----"
  const out = new X509TrustStore()
  let at: i32 = 0
  while (true) {
    const from: i32 = toI32(pem.indexOf(begin, at))
    if (from < 0) {
      break
    }
    const to: i32 = toI32(pem.indexOf(end, from))
    if (to < 0) {
      out.skipped = out.skipped + 1
      break
    }
    at = to + toI32(end.length)
    const cert: X509Certificate | null = x509PathBlock(pem.slice(from, at))
    if (cert === null) {
      out.skipped = out.skipped + 1
    } else {
      out.anchors.push(cert)
    }
  }
  return toI32(out.anchors.length) === 0 ? null : out
}

/**
 * The operating system's trust store: the first of the usual CA bundles that
 * can be read, as `x509TrustStoreFromPem` reads it, or `null` when none can
 * or the one read holds no certificate this module accepts.
 */
export const x509SystemTrustStore = (): X509TrustStore | null => {
  for (const path of x509SystemBundles()) {
    const pem: string | null = readFileSyncOrNull(path)
    if (pem !== null) {
      return x509TrustStoreFromPem(pem)
    }
  }
  return null
}

/** What `code` (an `X509_PATH_*`) means, for a log line or an error. */
export const x509PathReason = (code: i32): string => {
  const reasons: string[] = [
    "ok",
    "the chain is empty",
    "the chain is longer than 8 certificates",
    "a certificate is not DER X.509",
    "a certificate's extensions are malformed",
    "a certificate has an unrecognised critical extension",
    "a certificate has expired",
    "a certificate is not yet valid",
    "the host is not among the certificate's subjectAltName names",
    "the certificate's extKeyUsage does not allow serverAuth",
    "the certificate's keyUsage does not allow digitalSignature",
    "an issuer is not a CA",
    "an issuer's pathLenConstraint is exceeded",
    "an issuer's keyUsage does not allow keyCertSign",
    "a certificate's issuer is not the next certificate's subject",
    "a signature does not verify",
    "a signature uses an algorithm or key this module does not check",
    "no trust anchor issued the chain",
    "a name is outside an issuer's nameConstraints",
    "an issuer's nameConstraints uses a form this module cannot check",
  ]
  if (code < 0 || code >= toI32(reasons.length)) {
    return "unknown reason"
  }
  return reasons[code]
}

// ---------------------------------------------------------------------------
// Bytes and names
// ---------------------------------------------------------------------------

/** Whether two byte strings are equal. Both are public here. */
const x509PathBytesEqual = (a: u8[], b: u8[]): boolean => {
  if (toI32(a.length) !== toI32(b.length)) {
    return false
  }
  for (let k: i32 = 0; k < toI32(a.length) && k < toI32(b.length); k++) {
    if (a[k] !== b[k]) {
      return false
    }
  }
  return true
}

/** `c` lowered if it is an ASCII capital. */
const x509PathLower = (c: i32): i32 => (c >= 65 && c <= 90 ? c + 32 : c)

/**
 * `host` as lowered ASCII octets, without one trailing dot and without the
 * brackets of an IPv6 literal, or `null` when it is empty or holds a byte
 * outside printable ASCII.
 */
const x509PathHostBytes = (host: string): u8[] | null => {
  let from: i32 = 0
  let to: i32 = toI32(host.length)
  if (to >= 2 && toI32(host.charCodeAt(0)) === 0x5b && toI32(host.charCodeAt(to - 1)) === 0x5d) {
    from = 1
    to = to - 1
  } else if (to >= 1 && toI32(host.charCodeAt(to - 1)) === 0x2e) {
    to = to - 1
  }
  if (from >= to) {
    return null
  }
  const out: u8[] = []
  for (let k: i32 = from; k < to; k++) {
    const c: i32 = toI32(host.charCodeAt(k))
    if (c < 0x21 || c > 0x7e) {
      return null
    }
    out.push(toU8(x509PathLower(c)))
  }
  return out
}

/** The value of the decimal digits `s[from .. to)`, or `-1` unless there are 1 to 3 of them, with no leading zero, below 256. */
const x509PathOctet = (s: u8[], from: i32, to: i32): i32 => {
  if (from < 0 || to > toI32(s.length) || to - from < 1 || to - from > 3) {
    return -1
  }
  if (to - from > 1 && toI32(s[from]) === 0x30) {
    return -1
  }
  let v: i32 = 0
  for (let k: i32 = from; k >= 0 && k < to && k < toI32(s.length); k++) {
    const d: i32 = toI32(s[k]) - 0x30
    if (d < 0 || d > 9) {
      return -1
    }
    v = v * 10 + d
  }
  return v < 256 ? v : -1
}

/** `s` as a dotted-quad IPv4 address, or `null`. */
const x509PathIpv4 = (s: u8[]): u8[] | null => {
  const out: u8[] = []
  let from: i32 = 0
  const n: i32 = toI32(s.length)
  for (let k: i32 = 0; k <= n; k++) {
    if (k === n || (k < toI32(s.length) && toI32(s[k]) === 0x2e)) {
      const v: i32 = x509PathOctet(s, from, k)
      if (v < 0) {
        return null
      }
      out.push(toU8(v))
      from = k + 1
    }
  }
  return toI32(out.length) === 4 ? out : null
}

/** The value of hex digit `c`, or `-1`. */
const x509PathHex = (c: i32): i32 => {
  if (c >= 0x30 && c <= 0x39) {
    return c - 0x30
  }
  if (c >= 0x61 && c <= 0x66) {
    return c - 0x61 + 10
  }
  return -1
}

/**
 * `s` as an IPv6 address in RFC 4291 §2.2's first two forms — eight groups of
 * one to four hex digits, or fewer around one `::` — or `null`. The dotted
 * IPv4 tail and a zone are not accepted.
 */
const x509PathIpv6 = (s: u8[]): u8[] | null => {
  const head: i32[] = []
  const tail: i32[] = []
  let gap: boolean = false
  let k: i32 = 0
  const n: i32 = toI32(s.length)
  if (n >= 2 && toI32(s[0]) === 0x3a && toI32(s[1]) === 0x3a) {
    gap = true
    k = 2
  }
  while (k < n) {
    let v: i32 = 0
    let digits: i32 = 0
    while (k >= 0 && k < toI32(s.length) && x509PathHex(toI32(s[k])) >= 0 && digits < 5) {
      v = v * 16 + x509PathHex(toI32(s[k]))
      digits = digits + 1
      k = k + 1
    }
    if (digits < 1 || digits > 4) {
      return null
    }
    if (gap) {
      tail.push(v)
    } else {
      head.push(v)
    }
    if (k === n) {
      break
    }
    if (k < 0 || k + 1 >= toI32(s.length) || toI32(s[k]) !== 0x3a) {
      return null
    }
    k = k + 1
    if (k < toI32(s.length) && toI32(s[k]) === 0x3a) {
      if (gap) {
        return null
      }
      gap = true
      k = k + 1
    }
  }
  const groups: i32 = toI32(head.length) + toI32(tail.length)
  if (gap ? groups > 7 : groups !== 8) {
    return null
  }
  const out: u8[] = new Array<u8>(16)
  for (let g: i32 = 0; g < toI32(head.length); g++) {
    out[g * 2] = toU8(head[g] >> 8)
    out[g * 2 + 1] = toU8(head[g] & 0xff)
  }
  const skip: i32 = 8 - toI32(tail.length)
  for (let g: i32 = 0; g < toI32(tail.length); g++) {
    out[(skip + g) * 2] = toU8(tail[g] >> 8)
    out[(skip + g) * 2 + 1] = toU8(tail[g] & 0xff)
  }
  return out
}

/** Whether `s` holds byte `c`. */
const x509PathHas = (s: u8[], c: i32): boolean => {
  for (let k: i32 = 0; k < toI32(s.length); k++) {
    if (toI32(s[k]) === c) {
      return true
    }
  }
  return false
}

/** Whether every byte of `s` is a digit or a dot: a name that must be an IPv4 address or nothing. */
const x509PathAllDigitsDots = (s: u8[]): boolean => {
  for (let k: i32 = 0; k < toI32(s.length); k++) {
    const c: i32 = toI32(s[k])
    if (c !== 0x2e && (c < 0x30 || c > 0x39)) {
      return false
    }
  }
  return true
}

/**
 * Whether `name` is a host name of non-empty labels: no empty label, no `*`,
 * which `x509PathHostBytes`' printable ASCII leaves as the only test.
 */
const x509PathIsDnsName = (name: u8[]): boolean => {
  const n: i32 = toI32(name.length)
  if (n === 0 || toI32(name[0]) === 0x2e || toI32(name[n - 1]) === 0x2e || x509PathHas(name, 0x2a)) {
    return false
  }
  for (let k: i32 = 1; k < n; k++) {
    if (toI32(name[k]) === 0x2e && toI32(name[k - 1]) === 0x2e) {
      return false
    }
  }
  return true
}

/** Whether `a[ai ..)` and `b[bi ..)` are equal ignoring ASCII case. */
const x509PathTailEqual = (a: u8[], ai: i32, b: u8[], bi: i32): boolean => {
  if (toI32(a.length) - ai !== toI32(b.length) - bi) {
    return false
  }
  for (let k: i32 = 0; ai + k < toI32(a.length); k++) {
    if (x509PathLower(toI32(a[ai + k])) !== x509PathLower(toI32(b[bi + k]))) {
      return false
    }
  }
  return true
}

/**
 * Whether the dNSName `pattern` names the lowered DNS host `host` (RFC 6125
 * §6.4): equal ignoring ASCII case, or `*.` then a name of at least two labels
 * whose `*` stands for exactly one non-empty label of `host` (§6.4.3, with the
 * CA/Browser Forum's limit that `*` is the whole left-most label). A pattern
 * holding a byte outside printable ASCII, or a `*` anywhere else, names
 * nothing.
 */
const x509PathDnsMatches = (pattern: u8[], host: u8[]): boolean => {
  const n: i32 = toI32(pattern.length)
  for (let k: i32 = 0; k < n; k++) {
    const c: i32 = toI32(pattern[k])
    if (c < 0x21 || c > 0x7e || (c === 0x2a && k !== 0)) {
      return false
    }
  }
  if (n < 2 || toI32(pattern[0]) !== 0x2a) {
    return n > 0 && x509PathTailEqual(pattern, 0, host, 0)
  }
  if (toI32(pattern[1]) !== 0x2e) {
    return false
  }
  // The rest after `*.` must itself be at least two labels: `*.com` names nothing.
  const rest: u8[] = []
  for (let k: i32 = 2; k < toI32(pattern.length); k++) {
    rest.push(pattern[k])
  }
  if (!x509PathIsDnsName(rest) || !x509PathHas(rest, 0x2e)) {
    return false
  }
  let dot: i32 = -1
  for (let k: i32 = 0; k < toI32(host.length) && dot < 0; k++) {
    if (toI32(host[k]) === 0x2e) {
      dot = k
    }
  }
  return dot > 0 && x509PathTailEqual(pattern, 1, host, dot)
}

/**
 * Whether `cert`'s subjectAltName names `host` (RFC 6125 §6): an IP literal
 * against its iPAddress entries by bytes, any other name against its dNSName
 * entries. A host of digits and dots that is not a dotted quad names nothing.
 */
const x509PathHostMatches = (cert: X509Certificate, host: u8[]): boolean => {
  let ip: u8[] | null = null
  if (x509PathHas(host, 0x3a)) {
    ip = x509PathIpv6(host)
    if (ip === null) {
      return false
    }
  } else if (x509PathAllDigitsDots(host)) {
    ip = x509PathIpv4(host)
    if (ip === null) {
      return false
    }
  }
  if (ip !== null) {
    for (const addr of cert.ipAddresses) {
      if (x509PathBytesEqual(addr, ip)) {
        return true
      }
    }
    return false
  }
  if (!x509PathIsDnsName(host)) {
    return false
  }
  for (const pattern of cert.dnsNames) {
    if (x509PathDnsMatches(pattern, host)) {
      return true
    }
  }
  return false
}

/**
 * Whether the dNSName constraint `base` covers `name` (RFC 5280 §4.2.1.10):
 * an empty base covers every name, `example.com` covers itself and any name
 * ending `.example.com`, and `.example.com` only the latter. Case is ignored.
 */
const x509PathDnsWithin = (name: u8[], base: u8[]): boolean => {
  const b: i32 = toI32(base.length)
  const n: i32 = toI32(name.length)
  if (b === 0) {
    return true
  }
  if (toI32(base[0]) === 0x2e) {
    return n > b && x509PathTailEqual(name, n - b, base, 0)
  }
  if (n === b) {
    return x509PathTailEqual(name, 0, base, 0)
  }
  return n > b && toI32(name[n - b - 1]) === 0x2e && x509PathTailEqual(name, n - b, base, 0)
}

/** Whether `addr` lies in the iPAddress constraint `subtree`: an address of its length, then a mask. */
const x509PathIpWithin = (addr: u8[], subtree: u8[]): boolean => {
  const n: i32 = toI32(addr.length)
  if (toI32(subtree.length) !== 2 * n) {
    return false
  }
  for (let k: i32 = 0; k < n && k < toI32(subtree.length); k++) {
    const m: i32 = n + k
    if (m < 0 || m >= toI32(subtree.length)) {
      return false
    }
    const mask: i32 = toI32(subtree[m])
    if ((toI32(addr[k]) & mask) !== (toI32(subtree[k]) & mask)) {
      return false
    }
  }
  return true
}

/**
 * Whether `name`, of the form `dns` says, is allowed by `ca`'s
 * nameConstraints: inside one permitted subtree of its form when there is
 * any, and inside no excluded one.
 */
const x509PathNameAllowed = (ca: X509Certificate, name: u8[], dns: boolean): boolean => {
  const permitted: u8[][] = dns ? ca.permittedDns : ca.permittedIp
  const excluded: u8[][] = dns ? ca.excludedDns : ca.excludedIp
  for (const tree of excluded) {
    if (dns ? x509PathDnsWithin(name, tree) : x509PathIpWithin(name, tree)) {
      return false
    }
  }
  if (toI32(permitted.length) === 0) {
    return true
  }
  for (const tree of permitted) {
    if (dns ? x509PathDnsWithin(name, tree) : x509PathIpWithin(name, tree)) {
      return true
    }
  }
  return false
}

/**
 * `ca`'s nameConstraints applied to the leaf's subjectAltName names and to
 * `host`, as an `X509_PATH_*` code. A dNSName's wildcard label is checked as
 * the literal `*`; `host`, checked too, is the name the connection uses.
 */
const x509PathConstraints = (ca: X509Certificate, leaf: X509Certificate, host: u8[]): i32 => {
  if (!ca.hasNameConstraints) {
    return X509_PATH_OK
  }
  if (ca.nameConstraintsUnsupported) {
    return X509_PATH_UNSUPPORTED_NAME_CONSTRAINT
  }
  for (const name of leaf.dnsNames) {
    if (!x509PathNameAllowed(ca, name, true)) {
      return X509_PATH_NAME_CONSTRAINTS
    }
  }
  for (const addr of leaf.ipAddresses) {
    if (!x509PathNameAllowed(ca, addr, false)) {
      return X509_PATH_NAME_CONSTRAINTS
    }
  }
  let ip: u8[] | null = x509PathIpv6(host)
  if (ip === null) {
    ip = x509PathIpv4(host)
  }
  const allowed: boolean =
    ip !== null ? x509PathNameAllowed(ca, ip, false) : x509PathNameAllowed(ca, host, true)
  return allowed ? X509_PATH_OK : X509_PATH_NAME_CONSTRAINTS
}

// ---------------------------------------------------------------------------
// The path (RFC 5280 §6.1)
// ---------------------------------------------------------------------------

/** `cert`'s extensions and validity at `now` (seconds), as an `X509_PATH_*` code. */
const x509PathCertStatus = (cert: X509Certificate, now: i64): i32 => {
  if (cert.extensionsMalformed) {
    return X509_PATH_MALFORMED_EXTENSION
  }
  if (cert.unknownCriticalExtension) {
    return X509_PATH_UNKNOWN_CRITICAL_EXTENSION
  }
  // The fields are whole seconds in milliseconds, so dividing loses nothing and cannot overflow.
  if (cert.notAfter / 1000 < now) {
    return X509_PATH_EXPIRED
  }
  if (cert.notBefore / 1000 > now) {
    return X509_PATH_NOT_YET_VALID
  }
  return X509_PATH_OK
}

/** Whether `key` (an `X509_KEY_*`) is an elliptic-curve key. */
const x509PathEcKey = (key: i32): boolean => key === X509_KEY_P256 || key === X509_KEY_P384

/**
 * Whether `cert`'s signature verifies under `issuer`'s key, as an
 * `X509_PATH_*` code: ecdsa-with-SHA256 under P-256 is checked, a mismatch of
 * signature family and key type is `BAD_SIGNATURE`, and any other pairing
 * `UNSUPPORTED_ALGORITHM`.
 */
const x509PathVerify = (cert: X509Certificate, issuer: X509Certificate): i32 => {
  const sig: i32 = cert.signatureAlgorithm
  const key: i32 = issuer.keyAlgorithm
  if (sig === X509_SIG_ECDSA_SHA256 && key === X509_KEY_P256) {
    const rs: u8[] | null = x509DerSignatureRS(cert.signature)
    return rs !== null && p256VerifySha256(issuer.publicKey, cert.tbs, rs)
      ? X509_PATH_OK
      : X509_PATH_BAD_SIGNATURE
  }
  if (sig === X509_SIG_OTHER || key === X509_KEY_OTHER) {
    return X509_PATH_UNSUPPORTED_ALGORITHM
  }
  const ecdsa: boolean = sig === X509_SIG_ECDSA_SHA256 || sig === X509_SIG_ECDSA_SHA384
  if (ecdsa !== x509PathEcKey(key) || (!ecdsa && key !== X509_KEY_RSA)) {
    return X509_PATH_BAD_SIGNATURE
  }
  return X509_PATH_UNSUPPORTED_ALGORITHM
}

/**
 * Whether `chainDer` — a server's certificates, leaf first, each issued by the
 * next — is a path from a certificate valid for `host` at `nowSeconds` (Unix
 * time) to one of `trust`'s anchors, as an `X509_PATH_*` code: `X509_PATH_OK`,
 * or the first reason it is not. The module comment lists what is and is not
 * checked; `x509PathReason` words the code.
 */
export const x509ValidatePath = (
  chainDer: u8[][],
  trust: X509TrustStore,
  host: string,
  nowSeconds: i64
): i32 => {
  const n: i32 = toI32(chainDer.length)
  if (n === 0) {
    return X509_PATH_EMPTY
  }
  if (n > X509_PATH_MAX_CHAIN) {
    return X509_PATH_TOO_LONG
  }
  const chain: X509Certificate[] = []
  for (const der of chainDer) {
    const cert: X509Certificate | null = x509ParseCertificate(der)
    if (cert === null) {
      return X509_PATH_MALFORMED
    }
    chain.push(cert)
  }
  const leaf: X509Certificate = chain[0]
  const leafStatus: i32 = x509PathCertStatus(leaf, nowSeconds)
  if (leafStatus !== X509_PATH_OK) {
    return leafStatus
  }
  if (leaf.hasExtKeyUsage && !leaf.ekuServerAuth && !leaf.ekuAny) {
    return X509_PATH_LEAF_EKU
  }
  if (leaf.hasKeyUsage && (leaf.keyUsage & X509_KU_DIGITAL_SIGNATURE) === 0) {
    return X509_PATH_LEAF_KEY_USAGE
  }
  const name: u8[] | null = x509PathHostBytes(host)
  if (name === null || !x509PathHostMatches(leaf, name)) {
    return X509_PATH_HOSTNAME_MISMATCH
  }

  for (let at: i32 = 0; at < toI32(chain.length); at++) {
    const cert: X509Certificate = chain[at]
    // A trust anchor that issued `cert` ends the path; one whose name matches
    // but whose signature does not is remembered in case nothing else does.
    let anchorCode: i32 = X509_PATH_UNTRUSTED_ROOT
    for (const anchor of trust.anchors) {
      if (x509PathBytesEqual(anchor.subject, cert.issuer)) {
        const code: i32 = x509PathVerify(cert, anchor)
        if (code === X509_PATH_OK) {
          return x509PathConstraints(anchor, leaf, name)
        }
        if (anchorCode === X509_PATH_UNTRUSTED_ROOT || code === X509_PATH_UNSUPPORTED_ALGORITHM) {
          anchorCode = code
        }
      }
    }
    const up: i32 = at + 1
    if (up >= toI32(chain.length)) {
      return anchorCode
    }
    const issuer: X509Certificate = chain[up]
    const status: i32 = x509PathCertStatus(issuer, nowSeconds)
    if (status !== X509_PATH_OK) {
      return status
    }
    if (issuer.version !== 3 || !issuer.isCa) {
      return X509_PATH_NOT_CA
    }
    // `at` CA certificates lie between `issuer` and the leaf: chain[1 .. at].
    if (issuer.pathLenConstraint >= 0 && at > issuer.pathLenConstraint) {
      return X509_PATH_PATH_LEN_EXCEEDED
    }
    if (!issuer.hasKeyUsage || (issuer.keyUsage & X509_KU_KEY_CERT_SIGN) === 0) {
      return X509_PATH_NO_KEY_CERT_SIGN
    }
    if (!x509PathBytesEqual(cert.issuer, issuer.subject)) {
      return X509_PATH_ISSUER_MISMATCH
    }
    const signed: i32 = x509PathVerify(cert, issuer)
    if (signed !== X509_PATH_OK) {
      return signed
    }
    const constrained: i32 = x509PathConstraints(issuer, leaf, name)
    if (constrained !== X509_PATH_OK) {
      return constrained
    }
  }
  return X509_PATH_UNTRUSTED_ROOT
}

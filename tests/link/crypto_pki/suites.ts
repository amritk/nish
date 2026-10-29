// The suites of `crypto_pki`, shared with `crypto_pki_f64`, which compiles
// them with `--number-mode f64`: every certificate fixtures.ts holds, judged
// at NOW_MS against a store of its two roots. Each refusal has a fixture of
// its own that differs from an accepted one in the one thing checked, so a
// refusal whose check is removed passes and fails its test.
import { Suite } from "nish/testing"
import {
  PKI_ERR_BAD_SIGNATURE,
  PKI_ERR_BUDGET,
  PKI_ERR_CHAIN_TOO_LONG,
  PKI_ERR_EXPIRED,
  PKI_ERR_EXT_KEY_USAGE,
  PKI_ERR_HOSTNAME,
  PKI_ERR_KEY_USAGE,
  PKI_ERR_MALFORMED,
  PKI_ERR_NAME_CONSTRAINTS,
  PKI_ERR_NOT_CA,
  PKI_ERR_NOT_YET_VALID,
  PKI_ERR_PATH_LENGTH,
  PKI_ERR_UNKNOWN_CRITICAL,
  PKI_ERR_UNSUPPORTED_ALGORITHM,
  PKI_ERR_UNTRUSTED,
  PKI_ERR_WEAK_KEY,
  PKI_MAX_CHAIN_BYTES,
  PKI_MAX_CHAIN_CERTS,
  PKI_OK,
  PkiResult,
  PkiTrustStore,
  pkiMatchHostname,
  pkiReason,
  pkiTrustStore,
  pkiVerifyServer,
  pkiVerifySignature,
} from "nish/crypto/pki"
import { X509Certificate, x509ParseCertificate } from "nish/crypto/x509"
import { fromHex } from "../crypto_x25519/hex"
import {
  CHAIN1,
  CHAIN2,
  CHAIN3,
  CHAIN4,
  CHAIN5,
  CHAIN6,
  CHAIN7,
  EDROOT,
  EDROOT_P256,
  INT,
  INT_256,
  INT_257,
  INT_ANYEKU,
  INT_CLIENT,
  INT_CRITICAL,
  INT_EXPIRED,
  INT_FUTURE,
  INT_NC_DIR,
  INT_NC_DIRPERM,
  INT_NC_EMAIL,
  INT_NC_EXCLUDED,
  INT_NC_IP,
  INT_NC_IPEXCL,
  INT_NC_OK,
  INT_NC_PERMITTED,
  INT_NOBC,
  INT_NOCA,
  INT_NOKCS,
  INT_NC_IP6,
  INT_PATHLEN0,
  INT_ROLL,
  INT_SHA1,
  INT_EDKEY,
  INT_WRONG,
  INT_WRONGID,
  LEAF,
  LEAF_1024,
  LEAF_1025,
  LEAF_CA,
  LEAF_CLIENT,
  LEAF_CN,
  LEAF_CRITICAL,
  LEAF_DEEP,
  LEAF_DEEP8,
  LEAF_ED,
  LEAF_EMPTYISS,
  LEAF_EXPIRED,
  LEAF_FUTURE,
  LEAF_KU,
  LEAF_LOOP,
  LEAF_NOSUBJ,
  LEAF_ROLL,
  LEAF_RSA,
  LEAF_RSA384,
  LEAF_RSA512,
  LEAF_RWEAK,
  LEAF_SAME,
  LEAF_SUB,
  LEAF_SUFFIX,
  LOOPA,
  LOOPB,
  NOW_MS,
  OTHER,
  RINT,
  RINT_PSS,
  ROOT,
  ROOT_EMPTY,
  ROOT_NOCA,
  RROOT,
  RWEAK,
  SAME,
  SUB,
} from "./fixtures"

const parsed = (der: u8[]): X509Certificate => {
  const c: X509Certificate | null = x509ParseCertificate(der)
  if (c === null) {
    return new X509Certificate()
  }
  return c
}

const cert = (hex: string): X509Certificate => parsed(fromHex(hex))

const ders = (hexes: string[]): u8[][] => {
  const out: u8[][] = []
  for (const h of hexes) {
    out.push(fromHex(h))
  }
  return out
}

const store = (): PkiTrustStore => pkiTrustStore([cert(ROOT), cert(EDROOT)])

const rsaVerify = (hexes: string[], root: string): i32 =>
  pkiVerifyServer(ders(hexes), "example.com", NOW_MS, pkiTrustStore([cert(root)])).code

const verify = (hexes: string[], host: string): i32 =>
  pkiVerifyServer(ders(hexes), host, NOW_MS, store()).code

/** `count` copies of `hex`, after `first`. */
const copies = (first: string, hex: string, count: i32): u8[][] => {
  const out: u8[][] = [fromHex(first)]
  const der: u8[] = fromHex(hex)
  for (let i: i32 = 0; i < count; i++) {
    out.push(der)
  }
  return out
}

/** `n` bytes that are no certificate. */
const junk = (n: i32): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(48))
  }
  return out
}

const eqCode = (s: Suite, name: string, got: i32, want: i32): boolean =>
  got === want ? s.pass(name) : s.fail(name, `${pkiReason(got)} (${got}), wanted ${pkiReason(want)} (${want})`)

export const accepts = (mode: string): i32 => {
  const s = new Suite(`pki accepts${mode}`)
  const r: PkiResult = pkiVerifyServer(ders([LEAF, INT]), "example.com", NOW_MS, store())
  eqCode(s, "P-256 leaf, P-384 intermediate, P-384 root", r.code, PKI_OK)
  s.eqI32("the path is leaf, intermediate, root", toI32(r.path.length), toI32(3))
  if (toI32(r.path.length) === 3) {
    s.ok("the path ends at the root", r.path[2].der.length === cert(ROOT).der.length)
  } else {
    s.fail("the path ends at the root", "no path")
  }
  const shuffled: PkiResult = pkiVerifyServer(
    ders([LEAF, OTHER, ROOT, INT_EXPIRED, INT]),
    "example.com",
    NOW_MS,
    store()
  )
  eqCode(s, "out of order, with extra certificates", shuffled.code, PKI_OK)
  s.eqI32("the extras are not in the path", toI32(shuffled.path.length), toI32(3))
  eqCode(s, "an Ed25519 root signs the leaf", verify([LEAF_ED], "example.com"), PKI_OK)
  eqCode(s, "RSA leaf, intermediate and root, PKCS#1 v1.5", rsaVerify([LEAF_RSA, RINT], RROOT), PKI_OK)
  eqCode(s, "an RSA-PSS intermediate", rsaVerify([LEAF_RSA, RINT_PSS], RROOT), PKI_OK)
  eqCode(s, "RSA with SHA-384", rsaVerify([LEAF_RSA384, RINT], RROOT), PKI_OK)
  eqCode(s, "RSA with SHA-512", rsaVerify([LEAF_RSA512, RINT], RROOT), PKI_OK)
  eqCode(s, "a wildcard name", verify([LEAF, INT], "www.example.org"), PKI_OK)
  eqCode(s, "an IPv4 address", verify([LEAF, INT], "192.0.2.1"), PKI_OK)
  eqCode(s, "an IPv6 address", verify([LEAF, INT], "[2001:db8::1]"), PKI_OK)
  eqCode(s, "anyExtendedKeyUsage on an intermediate", verify([LEAF, INT_ANYEKU], "example.com"), PKI_OK)
  eqCode(s, "pathLen 0 above the leaf", verify([LEAF, INT_PATHLEN0], "example.com"), PKI_OK)
  eqCode(s, "pathLen 0 does not count a self-issued CA", verify([LEAF_ROLL, INT_ROLL, INT_PATHLEN0], "example.com"), PKI_OK)
  eqCode(s, "two intermediates", verify([LEAF_SUB, SUB, INT], "example.com"), PKI_OK)
  eqCode(s, "name constraints the leaf meets", verify([LEAF, INT_NC_OK], "example.com"), PKI_OK)
  eqCode(s, "name constraints, by address", verify([LEAF, INT_NC_OK], "2001:db8::1"), PKI_OK)
  eqCode(
    s,
    "a directoryName constraint skips a self-issued CA",
    verify([LEAF_ROLL, INT_ROLL, INT_NC_OK], "example.com"),
    PKI_OK
  )
  eqCode(s, "a leaf without a subject, under a directoryName constraint", verify([LEAF_NOSUBJ, INT_NC_OK], "example.com"), PKI_OK)
  eqCode(
    s,
    "a path of PKI_MAX_PATH certificates",
    verify([LEAF_DEEP8, CHAIN6, CHAIN5, CHAIN4, CHAIN3, CHAIN2, CHAIN1], "example.com"),
    PKI_OK
  )
  eqCode(s, "a leaf of PKI_MAX_NAMES names", verify([LEAF_1024, INT], "example.com"), PKI_OK)
  s.ok("pkiVerifySignature: the root signed the intermediate", pkiVerifySignature(cert(INT), cert(ROOT)))
  s.ok("pkiVerifySignature: Ed25519", pkiVerifySignature(cert(LEAF_ED), cert(EDROOT)))
  s.ok("pkiVerifySignature: not the root's signature", !pkiVerifySignature(cert(LEAF), cert(ROOT)))
  s.ok("pkiVerifySignature: P-256", pkiVerifySignature(cert(LEAF_SUB), cert(SUB)))
  const subTampered: u8[] = fromHex(LEAF_SUB)
  const subLast: i32 = toI32(subTampered.length) - 1
  subTampered[subLast] = toU8(toI32(subTampered[subLast]) ^ 1)
  s.ok("pkiVerifySignature: not a tampered P-256 signature", !pkiVerifySignature(parsed(subTampered), cert(SUB)))
  s.ok("pkiVerifySignature: RSA-PSS", pkiVerifySignature(cert(RINT_PSS), cert(RROOT)))
  s.ok("pkiVerifySignature: not the RSA root's signature", !pkiVerifySignature(cert(LEAF_RSA), cert(RROOT)))
  s.ok("pkiVerifySignature: SHA-1 is refused", !pkiVerifySignature(cert(INT_SHA1), cert(ROOT)))
  s.eqI32("a root given twice is kept once", toI32(pkiTrustStore([cert(ROOT), cert(ROOT), cert(OTHER)]).roots.length), toI32(2))
  return s.done()
}

export const refusals = (mode: string): i32 => {
  const s = new Suite(`pki refusals${mode}`)
  eqCode(s, "an expired leaf", verify([LEAF_EXPIRED, INT], "example.com"), PKI_ERR_EXPIRED)
  eqCode(s, "a leaf not yet valid", verify([LEAF_FUTURE, INT], "example.com"), PKI_ERR_NOT_YET_VALID)
  eqCode(s, "an expired intermediate", verify([LEAF, INT_EXPIRED], "example.com"), PKI_ERR_EXPIRED)
  eqCode(s, "an intermediate not yet valid", verify([LEAF, INT_FUTURE], "example.com"), PKI_ERR_NOT_YET_VALID)
  eqCode(s, "another host", verify([LEAF, INT], "example.net"), PKI_ERR_HOSTNAME)
  eqCode(s, "a name only in the common name", verify([LEAF_CN, INT], "example.com"), PKI_ERR_HOSTNAME)
  const others: PkiTrustStore = pkiTrustStore([cert(OTHER)])
  eqCode(
    s,
    "a root not in the store",
    pkiVerifyServer(ders([LEAF, INT]), "example.com", NOW_MS, others).code,
    PKI_ERR_UNTRUSTED
  )
  eqCode(s, "no intermediate", verify([LEAF], "example.com"), PKI_ERR_UNTRUSTED)
  eqCode(s, "the root sent, the intermediate not", verify([LEAF, ROOT], "example.com"), PKI_ERR_UNTRUSTED)
  eqCode(s, "an intermediate of another key", verify([LEAF, INT_WRONG], "example.com"), PKI_ERR_BAD_SIGNATURE)
  eqCode(s, "an intermediate whose key identifier is another's", verify([LEAF, INT_WRONGID], "example.com"), PKI_ERR_UNTRUSTED)
  eqCode(s, "an intermediate with CA:FALSE", verify([LEAF, INT_NOCA], "example.com"), PKI_ERR_NOT_CA)
  eqCode(s, "an intermediate without basicConstraints", verify([LEAF, INT_NOBC], "example.com"), PKI_ERR_NOT_CA)
  eqCode(s, "a CA as the leaf", verify([LEAF_CA, INT], "example.com"), PKI_ERR_NOT_CA)
  eqCode(s, "pathLen 0 above another CA", verify([LEAF_SUB, SUB, INT_PATHLEN0], "example.com"), PKI_ERR_PATH_LENGTH)
  eqCode(s, "an intermediate without keyCertSign", verify([LEAF, INT_NOKCS], "example.com"), PKI_ERR_KEY_USAGE)
  eqCode(s, "a leaf without digitalSignature", verify([LEAF_KU, INT], "example.com"), PKI_ERR_KEY_USAGE)
  eqCode(s, "an intermediate for clientAuth only", verify([LEAF, INT_CLIENT], "example.com"), PKI_ERR_EXT_KEY_USAGE)
  eqCode(s, "a leaf for clientAuth only", verify([LEAF_CLIENT, INT], "example.com"), PKI_ERR_EXT_KEY_USAGE)
  eqCode(s, "an unknown critical extension, intermediate", verify([LEAF, INT_CRITICAL], "example.com"), PKI_ERR_UNKNOWN_CRITICAL)
  eqCode(s, "an unknown critical extension, leaf", verify([LEAF_CRITICAL, INT], "example.com"), PKI_ERR_UNKNOWN_CRITICAL)
  eqCode(s, "SHA-1", verify([LEAF, INT_SHA1], "example.com"), PKI_ERR_UNSUPPORTED_ALGORITHM)
  eqCode(
    s,
    "an Ed25519 signature under a P-256 key",
    pkiVerifyServer(ders([LEAF_ED]), "example.com", NOW_MS, pkiTrustStore([cert(EDROOT_P256)])).code,
    PKI_ERR_UNSUPPORTED_ALGORITHM
  )
  eqCode(
    s,
    "an ECDSA signature under an Ed25519 key",
    pkiVerifyServer(ders([LEAF]), "example.com", NOW_MS, pkiTrustStore([cert(INT_EDKEY)])).code,
    PKI_ERR_UNSUPPORTED_ALGORITHM
  )
  eqCode(
    s,
    "an empty issuer names no root",
    pkiVerifyServer(ders([LEAF_EMPTYISS]), "example.com", NOW_MS, pkiTrustStore([cert(ROOT_EMPTY)])).code,
    PKI_ERR_UNTRUSTED
  )
  eqCode(s, "a cross-signed loop", verify([LEAF_LOOP, LOOPA, LOOPB], "example.com"), PKI_ERR_UNTRUSTED)
  eqCode(
    s,
    "a path past PKI_MAX_PATH",
    verify([LEAF_DEEP, CHAIN7, CHAIN6, CHAIN5, CHAIN4, CHAIN3, CHAIN2, CHAIN1], "example.com"),
    PKI_ERR_CHAIN_TOO_LONG
  )
  const tampered: u8[] = fromHex(LEAF)
  const last: i32 = toI32(tampered.length) - 1
  tampered[last] = toU8(toI32(tampered[last]) ^ 1)
  eqCode(
    s,
    "a tampered leaf signature",
    pkiVerifyServer([tampered, fromHex(INT)], "example.com", NOW_MS, store()).code,
    PKI_ERR_BAD_SIGNATURE
  )
  const edTampered: u8[] = fromHex(LEAF_ED)
  const edLast: i32 = toI32(edTampered.length) - 1
  edTampered[edLast] = toU8(toI32(edTampered[edLast]) ^ 1)
  eqCode(
    s,
    "a tampered Ed25519 signature",
    pkiVerifyServer([edTampered], "example.com", NOW_MS, store()).code,
    PKI_ERR_BAD_SIGNATURE
  )
  eqCode(s, "an RSA key under PKI_MIN_RSA_BITS", rsaVerify([LEAF_RWEAK], RWEAK), PKI_ERR_WEAK_KEY)
  const rsaTampered: u8[] = fromHex(LEAF_RSA)
  const rsaLast: i32 = toI32(rsaTampered.length) - 1
  rsaTampered[rsaLast] = toU8(toI32(rsaTampered[rsaLast]) ^ 1)
  eqCode(
    s,
    "a tampered RSA signature",
    pkiVerifyServer([rsaTampered, fromHex(RINT)], "example.com", NOW_MS, pkiTrustStore([cert(RROOT)])).code,
    PKI_ERR_BAD_SIGNATURE
  )
  const pssTampered: u8[] = fromHex(RINT_PSS)
  const pssLast: i32 = toI32(pssTampered.length) - 1
  pssTampered[pssLast] = toU8(toI32(pssTampered[pssLast]) ^ 1)
  eqCode(
    s,
    "a tampered RSA-PSS signature",
    pkiVerifyServer([fromHex(LEAF_RSA), pssTampered], "example.com", NOW_MS, pkiTrustStore([cert(RROOT)])).code,
    PKI_ERR_BAD_SIGNATURE
  )
  eqCode(s, "the nearest attempt's reason", verify([LEAF, INT_EXPIRED], "example.com"), PKI_ERR_EXPIRED)
  eqCode(s, "the first of two as near", verify([LEAF, INT_NOCA, INT_NOKCS], "example.com"), PKI_ERR_NOT_CA)
  eqCode(s, "the nearer of two", verify([LEAF, INT_NOCA, INT_SHA1], "example.com"), PKI_ERR_UNSUPPORTED_ALGORITHM)
  // INT_WRONG, in the store, fails beside the leaf; ROOT_NOCA fails a step
  // further, above INT. A root's attempt still outranks it.
  eqCode(
    s,
    "a root's reason before a longer path's",
    pkiVerifyServer(ders([LEAF, INT, ROOT_NOCA]), "example.com", NOW_MS, pkiTrustStore([cert(INT_WRONG)])).code,
    PKI_ERR_BAD_SIGNATURE
  )
  return s.done()
}

export const constraints = (mode: string): i32 => {
  const s = new Suite(`pki name constraints${mode}`)
  eqCode(s, "an excluded dNSName", verify([LEAF, INT_NC_EXCLUDED], "example.com"), PKI_ERR_NAME_CONSTRAINTS)
  eqCode(s, "a dNSName not permitted", verify([LEAF, INT_NC_PERMITTED], "example.com"), PKI_ERR_NAME_CONSTRAINTS)
  eqCode(s, "an rfc822Name subtree", verify([LEAF, INT_NC_EMAIL], "example.com"), PKI_ERR_NAME_CONSTRAINTS)
  eqCode(s, "an excluded directoryName", verify([LEAF, INT_NC_DIR], "example.com"), PKI_ERR_NAME_CONSTRAINTS)
  eqCode(s, "a subject not permitted", verify([LEAF, INT_NC_DIRPERM], "example.com"), PKI_ERR_NAME_CONSTRAINTS)
  eqCode(s, "an iPAddress not permitted", verify([LEAF, INT_NC_IP], "example.com"), PKI_ERR_NAME_CONSTRAINTS)
  eqCode(s, "an excluded iPAddress", verify([LEAF, INT_NC_IPEXCL], "example.com"), PKI_ERR_NAME_CONSTRAINTS)
  eqCode(s, "an IPv4 address under IPv6 subtrees", verify([LEAF, INT_NC_IP6], "example.com"), PKI_ERR_NAME_CONSTRAINTS)
  eqCode(s, "a name that only ends in a permitted one", verify([LEAF_SUFFIX, INT_NC_OK], "example.com"), PKI_ERR_NAME_CONSTRAINTS)
  return s.done()
}

export const bounds = (mode: string): i32 => {
  const s = new Suite(`pki bounds${mode}`)
  const none: u8[][] = []
  eqCode(s, "an empty chain", pkiVerifyServer(none, "example.com", NOW_MS, store()).code, PKI_ERR_MALFORMED)
  eqCode(s, "a leaf that is no certificate", pkiVerifyServer([junk(3)], "example.com", NOW_MS, store()).code, PKI_ERR_MALFORMED)
  eqCode(
    s,
    "an intermediate that is no certificate",
    pkiVerifyServer([fromHex(LEAF), junk(3)], "example.com", NOW_MS, store()).code,
    PKI_ERR_MALFORMED
  )
  const most: i32 = PKI_MAX_CHAIN_CERTS - 1
  eqCode(
    s,
    "PKI_MAX_CHAIN_CERTS certificates",
    pkiVerifyServer(copies(LEAF, LEAF, most), "example.com", NOW_MS, store()).code,
    PKI_ERR_UNTRUSTED
  )
  eqCode(
    s,
    "one more",
    pkiVerifyServer(copies(LEAF, LEAF, most + 1), "example.com", NOW_MS, store()).code,
    PKI_ERR_CHAIN_TOO_LONG
  )
  const leaf: u8[] = fromHex(LEAF)
  const fill: i32 = PKI_MAX_CHAIN_BYTES - toI32(leaf.length)
  eqCode(
    s,
    "PKI_MAX_CHAIN_BYTES bytes",
    pkiVerifyServer([leaf, junk(fill)], "example.com", NOW_MS, store()).code,
    PKI_ERR_MALFORMED
  )
  eqCode(
    s,
    "one byte more",
    pkiVerifyServer([leaf, junk(fill + 1)], "example.com", NOW_MS, store()).code,
    PKI_ERR_CHAIN_TOO_LONG
  )
  eqCode(s, "a leaf of more names", verify([LEAF_1025, INT], "example.com"), PKI_ERR_BUDGET)
  // INT_256 permits only names below example.com, so the leaf's *.example.org
  // is refused, by its name constraints and not by their count.
  eqCode(s, "an intermediate of PKI_MAX_SUBTREES subtrees", verify([LEAF, INT_256], "example.com"), PKI_ERR_NAME_CONSTRAINTS)
  eqCode(s, "an intermediate of more subtrees", verify([LEAF, INT_257], "example.com"), PKI_ERR_BUDGET)
  eqCode(s, "more name comparisons than PKI_MAX_NAME_CHECKS", verify([LEAF_1024, INT_256], "example.com"), PKI_ERR_BUDGET)
  // 100 copies of a self-issued CA, each with its own last signature byte:
  // each signs the leaf, none another, so the search tries every pair.
  const same: u8[][] = [fromHex(LEAF_SAME)]
  for (let i: i32 = 0; i < 100; i++) {
    const c: u8[] = fromHex(SAME)
    const at: i32 = toI32(c.length) - 1
    if (at >= 0 && at < toI32(c.length)) {
      c[at] = toU8((toI32(c[at]) + i + 1) & 255)
    }
    same.push(c)
  }
  eqCode(s, "more signatures than PKI_MAX_SIGNATURES", pkiVerifyServer(same, "example.com", NOW_MS, store()).code, PKI_ERR_BUDGET)
  return s.done()
}

/** `n` copies of the character `c`. */
const run = (c: string, n: i32): string => {
  let out: string = ""
  for (let i: i32 = 0; i < n; i++) {
    out = out + c
  }
  return out
}

/** Whether the leaf, its names replaced by `dns` and `ip`, names `host`. */
const names = (dns: string[], ip: u8[][], host: string): boolean => {
  const leaf: X509Certificate = cert(LEAF)
  leaf.sanDns = dns
  leaf.sanIp = ip
  return pkiMatchHostname(leaf, host)
}

export const hostnames = (mode: string): i32 => {
  const s = new Suite(`pki hostnames${mode}`)
  const leaf: X509Certificate = cert(LEAF)
  const none: u8[][] = []
  s.ok("the name", pkiMatchHostname(leaf, "example.com"))
  s.ok("without case", pkiMatchHostname(leaf, "EXAMPLE.Com"))
  s.ok("with a trailing dot", pkiMatchHostname(leaf, "example.com."))
  s.ok("not two trailing dots", !pkiMatchHostname(leaf, "example.com.."))
  s.ok("not a name below it", !pkiMatchHostname(leaf, "www.example.com"))
  s.ok("not a name above it", !pkiMatchHostname(leaf, "com"))
  s.ok("a wildcard's one label", pkiMatchHostname(leaf, "a.example.org"))
  s.ok("a wildcard without case", pkiMatchHostname(leaf, "A.EXAMPLE.ORG"))
  s.ok("not a wildcard's two labels", !pkiMatchHostname(leaf, "a.b.example.org"))
  s.ok("not a wildcard's base", !pkiMatchHostname(leaf, "example.org"))
  s.ok("not an empty label", !pkiMatchHostname(leaf, ".example.org"))
  s.ok("not an empty host", !pkiMatchHostname(leaf, ""))
  s.ok("not a space", !pkiMatchHostname(leaf, "exa mple.com"))
  s.ok("not a wildcard host", !pkiMatchHostname(leaf, "*.example.org"))
  s.ok("an IPv4 address", pkiMatchHostname(leaf, "192.0.2.1"))
  s.ok("not another address", !pkiMatchHostname(leaf, "192.0.2.2"))
  s.ok("not a leading zero", !pkiMatchHostname(leaf, "192.0.2.01"))
  s.ok("not three octets", !pkiMatchHostname(leaf, "192.0.2"))
  s.ok("not an octet over 255", !pkiMatchHostname(leaf, "192.0.2.256"))
  s.ok("an IPv6 address", pkiMatchHostname(leaf, "2001:db8::1"))
  s.ok("in brackets", pkiMatchHostname(leaf, "[2001:db8::1]"))
  s.ok("spelt out", pkiMatchHostname(leaf, "2001:0DB8:0:0:0:0:0:1"))
  s.ok("not another IPv6 address", !pkiMatchHostname(leaf, "2001:db8::2"))
  s.ok("not two gaps", !pkiMatchHostname(leaf, "2001::db8::1"))
  s.ok("not nine groups", !pkiMatchHostname(leaf, "2001:db8:0:0:0:0:0:0:1"))
  s.ok("not a group of five digits", !pkiMatchHostname(leaf, "2001:0db80::1"))
  s.ok("an address names no dNSName", !names(["192.0.2.1"], none, "192.0.2.1"))
  s.ok("an IPv4 address in IPv6", names([], [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 192, 0, 2, 1]], "::ffff:192.0.2.1"))
  s.ok("not the IPv4 address it maps", !names([], [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 192, 0, 2, 1]], "192.0.2.1"))
  s.ok("a dNSName in capitals", names(["EXAMPLE.COM"], none, "example.com"))
  s.ok("a dNSName with a trailing dot", names(["example.com."], none, "example.com"))
  s.ok("not *.com", !names(["*.com"], none, "example.com"))
  s.ok("not a partial wildcard", !names(["ex*.example.org"], none, "exa.example.org"))
  s.ok("not a wildcard inside", !names(["a.*.example.org"], none, "a.b.example.org"))
  s.ok("not an invalid dNSName", !names(["exa_mple..com"], none, "exa_mple..com"))
  s.ok("not a dNSName with a space", !names(["exa mple.com"], none, "exa mple.com"))
  s.ok("an underscore", names(["_srv.example.com"], none, "_srv.example.com"))
  s.ok("not a label of 64", !names(["a234567890123456789012345678901234567890123456789012345678901234.com"], none, "a234567890123456789012345678901234567890123456789012345678901234.com"))
  s.ok("a label of 63", names(["a23456789012345678901234567890123456789012345678901234567890123.com"], none, "a23456789012345678901234567890123456789012345678901234567890123.com"))
  const long: string = `${run("a", 63)}.${run("b", 63)}.${run("c", 63)}.`
  s.ok("a name of 253 octets", names([`${long}${run("d", 61)}`], none, `${long}${run("d", 61)}`))
  s.ok("not a name of 254 octets", !names([`${long}${run("d", 62)}`], none, `${long}${run("d", 62)}`))
  return s.done()
}

export const reasons = (mode: string): i32 => {
  const s = new Suite(`pki reasons${mode}`)
  const seen: string[] = []
  let distinct: boolean = true
  for (let code: i32 = 0; code <= 16; code++) {
    const r: string = pkiReason(code)
    if (r.length === 0 || seen.indexOf(r) >= 0) {
      distinct = false
    }
    seen.push(r)
  }
  s.ok("every code has a sentence of its own", distinct)
  s.ok("an unknown code has one too", pkiReason(99).length > 0)
  return s.done()
}

// `nish/crypto/x509-path` against chains Python's `cryptography` minted
// (fixtures.py writes fixtures.ts; each verdict below that OpenSSL can give
// was checked with `openssl verify -x509_strict -purpose sslserver -attime
// 1798761600 -verify_hostname <host> -CAfile root.pem -untrusted inter.pem`,
// whose answers the PR that added this program quotes).
//
// The good path — a leaf under an intermediate under a root — at each host
// form its subjectAltName holds; then one refusal per `X509_PATH_*` code, each
// a fixture that differs from the good path in that one way; the trust store's
// PEM reading and the system bundle; the extension fields the walk relies on,
// read back; and the algorithms not yet checked, which answer
// UNSUPPORTED_ALGORITHM until RSA and P-384 verification land.
import { Suite } from "nish/testing"
import { X509Certificate, derToPem, x509ParseCertificate } from "nish/crypto/x509"
import {
  X509TrustStore,
  X509_PATH_BAD_SIGNATURE,
  X509_PATH_EMPTY,
  X509_PATH_EXPIRED,
  X509_PATH_HOSTNAME_MISMATCH,
  X509_PATH_ISSUER_MISMATCH,
  X509_PATH_LEAF_EKU,
  X509_PATH_LEAF_KEY_USAGE,
  X509_PATH_MALFORMED,
  X509_PATH_MALFORMED_EXTENSION,
  X509_PATH_NAME_CONSTRAINTS,
  X509_PATH_NOT_CA,
  X509_PATH_NOT_YET_VALID,
  X509_PATH_NO_KEY_CERT_SIGN,
  X509_PATH_OK,
  X509_PATH_PATH_LEN_EXCEEDED,
  X509_PATH_TOO_LONG,
  X509_PATH_UNKNOWN_CRITICAL_EXTENSION,
  X509_PATH_UNSUPPORTED_ALGORITHM,
  X509_PATH_UNSUPPORTED_NAME_CONSTRAINT,
  X509_PATH_UNTRUSTED_ROOT,
  x509PathReason,
  x509SystemTrustStore,
  x509TrustStoreFromPem,
  x509ValidatePath,
} from "nish/crypto/x509-path"
import {
  CA_NC_EMAIL,
  CA_NC_EXCLUDE_IP,
  CA_NC_PERMIT_NET,
  CA_NC_PERMIT_OK,
  CA_NOT_CA,
  CA_NO_KU,
  DEEP,
  DEEP_SUB,
  IMPOSTER,
  INTER,
  LEAF,
  LEAF_ANY_EKU,
  LEAF_BAD_EXT,
  LEAF_BARE,
  LEAF_CLIENT_EKU,
  LEAF_CRITICAL,
  LEAF_DEEP,
  LEAF_ECDSA_UNDER_RSA,
  LEAF_KEY_ENC,
  LEAF_NC_EMAIL,
  LEAF_NC_EXCLUDE_IP,
  LEAF_NC_PERMIT_NET,
  LEAF_NC_PERMIT_OK,
  LEAF_NONCRITICAL,
  LEAF_NOT_CA,
  LEAF_NO_KU,
  LEAF_NO_SAN,
  LEAF_P384,
  LEAF_PSS,
  LEAF_RSA,
  LEAF_RSA_KEY,
  LEAF_SHA384,
  LEAF_SUB,
  LEAF_UNICODE,
  OTHER_ROOT,
  P384_ROOT,
  ROOT,
  RSA_ROOT,
  SUB,
} from "./fixtures"
import { fromHex } from "../crypto_x509/hex"

// 2027-01-01T00:00:00Z: a year into the fixtures' ten.
const NOW: i64 = 1798761600
// 2025-12-31T23:59:59Z and 2036-01-01T00:00:01Z: a second outside them.
const BEFORE: i64 = 1767225599
const AFTER: i64 = 2082758401

/** A trust store of the hex DER certificates `roots`. */
const storeOf = (roots: string[]): X509TrustStore => {
  let pem: string = ""
  for (const root of roots) {
    pem = pem + derToPem(fromHex(root), "CERTIFICATE")
  }
  const store: X509TrustStore | null = x509TrustStoreFromPem(pem)
  return store !== null ? store : new X509TrustStore()
}

/** The hex DER certificate `hex`, parsed; an empty certificate if it does not parse, which every field test then fails. */
const parsed = (hex: string): X509Certificate => {
  const cert: X509Certificate | null = x509ParseCertificate(fromHex(hex))
  return cert !== null ? cert : new X509Certificate()
}

/** The hex DER certificates `certs`, as `x509ValidatePath` takes them. */
const chainOf = (certs: string[]): u8[][] => {
  const out: u8[][] = []
  for (const c of certs) {
    out.push(fromHex(c))
  }
  return out
}

/** `x509ValidatePath`'s answer, worded, against `expected`'s. */
const expect = (t: Suite, name: string, chain: string[], trust: X509TrustStore, host: string, now: i64, expected: i32): boolean =>
  t.eqStr(name, x509PathReason(x509ValidatePath(chainOf(chain), trust, host, now)), x509PathReason(expected))

const goodSuite = (): i32 => {
  const t = new Suite("x509-path: the good path")
  const trust: X509TrustStore = storeOf([ROOT])
  const chain: string[] = [LEAF, INTER]
  expect(t, "example.com", chain, trust, "example.com", NOW, X509_PATH_OK)
  expect(t, "EXAMPLE.Com, case ignored", chain, trust, "EXAMPLE.Com", NOW, X509_PATH_OK)
  expect(t, "example.com. with its root dot", chain, trust, "example.com.", NOW, X509_PATH_OK)
  expect(t, "a.example.org under *.example.org", chain, trust, "a.example.org", NOW, X509_PATH_OK)
  expect(t, "the IPv4 address 192.0.2.1", chain, trust, "192.0.2.1", NOW, X509_PATH_OK)
  expect(t, "192.0.2.1. read as the address", chain, trust, "192.0.2.1.", NOW, X509_PATH_OK)
  expect(t, "the IPv6 address 2001:db8::1", chain, trust, "2001:db8::1", NOW, X509_PATH_OK)
  expect(t, "the IPv6 address bracketed and spelled out", chain, trust, "[2001:DB8:0:0:0:0:0:1]", NOW, X509_PATH_OK)
  expect(t, "the root sent too", [LEAF, INTER, ROOT], trust, "example.com", NOW, X509_PATH_OK)
  expect(t, "at the first second", chain, trust, "example.com", BEFORE + 1, X509_PATH_OK)
  expect(t, "at the last second", chain, trust, "example.com", AFTER - 1, X509_PATH_OK)
  expect(t, "an anchor among others", chain, storeOf([OTHER_ROOT, IMPOSTER, ROOT]), "example.com", NOW, X509_PATH_OK)
  expect(t, "extKeyUsage anyExtendedKeyUsage", [LEAF_ANY_EKU, INTER], trust, "example.com", NOW, X509_PATH_OK)
  expect(t, "a leaf with neither keyUsage nor extKeyUsage", [LEAF_BARE, INTER], trust, "example.com", NOW, X509_PATH_OK)
  expect(t, "an unknown non-critical extension", [LEAF_NONCRITICAL, INTER], trust, "example.com", NOW, X509_PATH_OK)
  expect(t, "two CAs under a pathLen 1", [LEAF_DEEP, DEEP_SUB, DEEP], trust, "example.com", NOW, X509_PATH_OK)
  expect(t, "a leaf with an RSA key", [LEAF_RSA_KEY, INTER], trust, "example.com", NOW, X509_PATH_OK)
  return t.done()
}

const hostSuite = (): i32 => {
  const t = new Suite("x509-path: names")
  const trust: X509TrustStore = storeOf([ROOT])
  const chain: string[] = [LEAF, INTER]
  const hosts: string[] = [
    "",
    ".",
    "example.org",
    "b.a.example.org",
    ".example.org",
    "*.example.org",
    "a..example.org",
    "www.example.com",
    "example.com..",
    "example.co",
    "xample.com",
    "192.0.2.2",
    "192.0.2.01",
    "192.0.2",
    "2001:db8::2",
    "2001:db8:::1",
    "2001:db8::1%eth0",
    "exa mple.com",
    "exämple.com",
  ]
  for (const host of hosts) {
    expect(t, `"${host}" is not a name of the leaf`, chain, trust, host, NOW, X509_PATH_HOSTNAME_MISMATCH)
  }
  expect(t, "the common name is not read", [LEAF_NO_SAN, INTER], trust, "example.com", NOW, X509_PATH_HOSTNAME_MISMATCH)
  expect(t, "an A-label matches as ASCII", [LEAF_UNICODE, INTER], trust, "XN--bcher-kva.example", NOW, X509_PATH_OK)
  return t.done()
}

const refusalSuite = (): i32 => {
  const t = new Suite("x509-path: refusals")
  const trust: X509TrustStore = storeOf([ROOT])
  const good: string[] = [LEAF, INTER]
  expect(t, "no certificate", [], trust, "example.com", NOW, X509_PATH_EMPTY)
  expect(t, "nine certificates", [LEAF, INTER, INTER, INTER, INTER, INTER, INTER, INTER, INTER], trust, "example.com", NOW, X509_PATH_TOO_LONG)
  expect(t, "a truncated intermediate", [LEAF, INTER.substring(0, 100)], trust, "example.com", NOW, X509_PATH_MALFORMED)
  expect(t, "basicConstraints holding NULL", [LEAF_BAD_EXT, INTER], trust, "example.com", NOW, X509_PATH_MALFORMED_EXTENSION)
  expect(t, "an unknown critical extension", [LEAF_CRITICAL, INTER], trust, "example.com", NOW, X509_PATH_UNKNOWN_CRITICAL_EXTENSION)
  expect(t, "a second after notAfter", good, trust, "example.com", AFTER, X509_PATH_EXPIRED)
  expect(t, "a second before notBefore", good, trust, "example.com", BEFORE, X509_PATH_NOT_YET_VALID)
  expect(t, "extKeyUsage clientAuth only", [LEAF_CLIENT_EKU, INTER], trust, "example.com", NOW, X509_PATH_LEAF_EKU)
  expect(t, "keyUsage keyEncipherment only", [LEAF_KEY_ENC, INTER], trust, "example.com", NOW, X509_PATH_LEAF_KEY_USAGE)
  expect(t, "an issuer with cA false", [LEAF_NOT_CA, CA_NOT_CA], trust, "example.com", NOW, X509_PATH_NOT_CA)
  expect(t, "the leaf as its own issuer's issuer", [LEAF, LEAF], trust, "example.com", NOW, X509_PATH_NOT_CA)
  expect(t, "a CA under pathLen 0", [LEAF_SUB, SUB, INTER], trust, "example.com", NOW, X509_PATH_PATH_LEN_EXCEEDED)
  expect(t, "an issuer without keyUsage", [LEAF_NO_KU, CA_NO_KU], trust, "example.com", NOW, X509_PATH_NO_KEY_CERT_SIGN)
  expect(t, "the intermediate left out", [LEAF, ROOT], trust, "example.com", NOW, X509_PATH_ISSUER_MISMATCH)
  expect(t, "another CA's leaf", [LEAF_NOT_CA, INTER], trust, "example.com", NOW, X509_PATH_ISSUER_MISMATCH)
  // The leaf's last byte is the end of its signature's s.
  const flipped: string = LEAF.substring(0, LEAF.length - 2) + (LEAF.endsWith("00") ? "01" : "00")
  expect(t, "a leaf signature with a byte changed", [flipped, INTER], trust, "example.com", NOW, X509_PATH_BAD_SIGNATURE)
  expect(t, "a root of the right name and another key", good, storeOf([IMPOSTER]), "example.com", NOW, X509_PATH_BAD_SIGNATURE)
  expect(t, "an ECDSA signature claimed under an RSA key", [LEAF_ECDSA_UNDER_RSA], storeOf([RSA_ROOT]), "example.com", NOW, X509_PATH_BAD_SIGNATURE)
  expect(t, "no anchor of the issuer's name", good, storeOf([OTHER_ROOT]), "example.com", NOW, X509_PATH_UNTRUSTED_ROOT)
  expect(t, "the leaf alone", [LEAF], trust, "example.com", NOW, X509_PATH_UNTRUSTED_ROOT)
  expect(t, "a CA certificate sent as the leaf", [INTER], trust, "example.com", NOW, X509_PATH_LEAF_KEY_USAGE)
  return t.done()
}

const constraintSuite = (): i32 => {
  const t = new Suite("x509-path: nameConstraints")
  const trust: X509TrustStore = storeOf([ROOT])
  const permitted: string[] = [LEAF_NC_PERMIT_OK, CA_NC_PERMIT_OK]
  expect(t, "inside every permitted subtree", permitted, trust, "example.com", NOW, X509_PATH_OK)
  expect(t, "the host a.example.org inside .example.org", permitted, trust, "a.example.org", NOW, X509_PATH_OK)
  expect(t, "the host 192.0.2.1 inside 192.0.2.0/24", permitted, trust, "192.0.2.1", NOW, X509_PATH_OK)
  expect(t, "example.com outside a permitted example.net", [LEAF_NC_PERMIT_NET, CA_NC_PERMIT_NET], trust, "example.com", NOW, X509_PATH_NAME_CONSTRAINTS)
  expect(t, "192.0.2.1 inside an excluded 192.0.2.0/28", [LEAF_NC_EXCLUDE_IP, CA_NC_EXCLUDE_IP], trust, "example.com", NOW, X509_PATH_NAME_CONSTRAINTS)
  expect(t, "an rfc822Name subtree", [LEAF_NC_EMAIL, CA_NC_EMAIL], trust, "example.com", NOW, X509_PATH_UNSUPPORTED_NAME_CONSTRAINT)
  return t.done()
}

const algorithmSuite = (): i32 => {
  const t = new Suite("x509-path: algorithms not yet checked")
  expect(t, "sha256WithRSAEncryption", [LEAF_RSA], storeOf([RSA_ROOT]), "example.com", NOW, X509_PATH_UNSUPPORTED_ALGORITHM)
  expect(t, "RSASSA-PSS with SHA-256", [LEAF_PSS], storeOf([RSA_ROOT]), "example.com", NOW, X509_PATH_UNSUPPORTED_ALGORITHM)
  expect(t, "ecdsa-with-SHA384 under P-384", [LEAF_P384], storeOf([P384_ROOT]), "example.com", NOW, X509_PATH_UNSUPPORTED_ALGORITHM)
  expect(t, "ecdsa-with-SHA384 under P-256", [LEAF_SHA384], storeOf([ROOT]), "example.com", NOW, X509_PATH_UNSUPPORTED_ALGORITHM)
  return t.done()
}

const storeSuite = (): i32 => {
  const t = new Suite("x509-path: trust stores")
  const root: string = derToPem(fromHex(ROOT), "CERTIFICATE")
  const other: string = derToPem(fromHex(OTHER_ROOT), "CERTIFICATE")
  const bundle: string =
    "# a bundle's comment\n" + root + "\n-----BEGIN CERTIFICATE-----\nnot base64!\n-----END CERTIFICATE-----\n" + other + "trailing text\n"
  const store: X509TrustStore | null = x509TrustStoreFromPem(bundle)
  t.ok("a bundle with a bad block reads", store !== null)
  if (store !== null) {
    t.eqI32("its two certificates", toI32(store.anchors.length), 2)
    t.eqI32("its bad block skipped", store.skipped, 1)
    expect(t, "and anchors the good path", [LEAF, INTER], store, "example.com", NOW, X509_PATH_OK)
  }
  const cut: X509TrustStore | null = x509TrustStoreFromPem(root + "-----BEGIN CERTIFICATE-----\nMIIB")
  t.ok("an unterminated block is skipped", cut !== null && toI32(cut.anchors.length) === 1 && cut.skipped === 1)
  t.ok("no block answers null", x509TrustStoreFromPem("no certificates here\n") === null)
  t.ok("only bad blocks answer null", x509TrustStoreFromPem("-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n") === null)
  t.ok("an empty string answers null", x509TrustStoreFromPem("") === null)
  // The machine's own bundle, which a runner may lack: when there is one, it reads.
  const system: X509TrustStore | null = x509SystemTrustStore()
  t.ok("the system store, if any, holds anchors", system === null || toI32(system.anchors.length) > 0)
  return t.done()
}

const fieldSuite = (): i32 => {
  const t = new Suite("x509-path: the extensions read")
  const leaf: X509Certificate = parsed(LEAF)
  t.eqI32("the leaf is v3", leaf.version, 3)
  t.ok("not a CA", leaf.hasBasicConstraints && !leaf.isCa && leaf.pathLenConstraint === -1)
  t.ok("keyUsage digitalSignature alone", leaf.hasKeyUsage && leaf.keyUsage === 1)
  t.ok("extKeyUsage serverAuth", leaf.hasExtKeyUsage && leaf.ekuServerAuth && !leaf.ekuAny)
  t.eqI32("two dNSNames", toI32(leaf.dnsNames.length), 2)
  t.eqI32("two iPAddresses", toI32(leaf.ipAddresses.length), 2)
  t.eqI32("the second 16 octets", toI32(leaf.ipAddresses[1].length), 16)
  const inter: X509Certificate = parsed(INTER)
  t.ok("the intermediate is a CA with pathLen 0", inter.isCa && inter.pathLenConstraint === 0)
  t.ok("keyCertSign and cRLSign", inter.keyUsage === 32 + 64)
  t.ok("no subjectAltName", !inter.hasSubjectAltName)
  const nc: X509Certificate = parsed(CA_NC_PERMIT_OK)
  t.ok("nameConstraints read", nc.hasNameConstraints && !nc.nameConstraintsUnsupported)
  t.eqI32("two permitted dNSNames", toI32(nc.permittedDns.length), 2)
  t.eqI32("two permitted iPAddresses", toI32(nc.permittedIp.length), 2)
  t.ok("an rfc822Name is unsupported", parsed(CA_NC_EMAIL).nameConstraintsUnsupported)
  t.ok("the unknown critical extension is flagged", parsed(LEAF_CRITICAL).unknownCriticalExtension)
  t.ok("the NULL basicConstraints is flagged", parsed(LEAF_BAD_EXT).extensionsMalformed)
  return t.done()
}

export const main = (): i32 =>
  goodSuite() + hostSuite() + refusalSuite() + constraintSuite() + algorithmSuite() + storeSuite() + fieldSuite()

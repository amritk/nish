// `nish/crypto/x509`'s v3 extensions, signature algorithms, key types and Name
// comparison, against the OpenSSL certificates in webpki.ts and against
// certificates composed here from FULL_DER's parts.
//
// The parser does not check a signature, so a composed certificate keeps
// FULL_DER's and is read, or refused, on its structure alone. Each refusal is
// paired with the nearest sound encoding read back, so a negative fails for the
// rule it names and not for a slip in the composition.
import { Suite } from "nish/testing"
import {
  X509_GN_DIR,
  X509_GN_DNS,
  X509_GN_IP,
  X509_HASH_SHA256,
  X509_HASH_SHA512,
  X509_KEY_ED25519,
  X509_KEY_P256,
  X509_KEY_P384,
  X509_KEY_RSA,
  X509_KEY_UNKNOWN,
  X509_KU_CRL_SIGN,
  X509_KU_DIGITAL_SIGNATURE,
  X509_KU_KEY_CERT_SIGN,
  X509_SIG_ECDSA_SHA256,
  X509_SIG_ECDSA_SHA384,
  X509_SIG_ED25519,
  X509_SIG_RSA_PKCS1_SHA1,
  X509_SIG_RSA_PKCS1_SHA256,
  X509_SIG_RSA_PKCS1_SHA384,
  X509_SIG_RSA_PKCS1_SHA512,
  X509_SIG_RSA_PSS,
  X509_SIG_UNKNOWN,
  X509Certificate,
  X509GeneralSubtree,
  x509CertificateHash,
  x509DerSignatureRSWidth,
  x509NameEqual,
  x509NameIsPrefix,
  pemToDer,
  x509ParseCertificate,
} from "nish/crypto/x509"
import { fromHex, toHex } from "./hex"
import { GOLDEN_PEM } from "./fixtures"
import {
  CRITICAL_DER,
  ED25519_CA_DER,
  ED25519_LEAF_DER,
  FULL_ALGORITHM,
  FULL_DER,
  FULL_EXT_AUTHORITY_KEY_ID,
  FULL_EXT_BASIC_CONSTRAINTS,
  FULL_EXT_EXT_KEY_USAGE,
  FULL_EXT_KEY_USAGE,
  FULL_EXT_NAME_CONSTRAINTS,
  FULL_EXT_SUBJECT_ALT_NAME,
  FULL_EXT_SUBJECT_KEY_ID,
  FULL_ISSUER,
  FULL_SERIAL,
  FULL_SHA256,
  FULL_SIGNATURE,
  FULL_SPKI,
  FULL_SUBJECT,
  FULL_VALIDITY,
  FULL_VERSION,
  P384_CA_DER,
  PSS_DER,
  RSA_DER,
} from "./webpki"

/** `n` zero octets as hex. */
const zeros = (n: i32): string => {
  let out: string = ""
  for (let i: i32 = 0; i < n; i++) {
    out = `${out}00`
  }
  return out
}

/** One octet as two hex digits. */
const hexByte = (n: i32): string => toHex([toU8(n)])

/** One DER element as hex: the identifier octet `tag`, the length of `body`, then `body`. */
const der = (tag: string, body: string): string => {
  const n: i32 = toI32(body.length) >> 1
  if (n < 128) {
    return `${tag}${hexByte(n)}${body}`
  }
  if (n < 256) {
    return `${tag}81${hexByte(n)}${body}`
  }
  return `${tag}82${hexByte(n >> 8)}${hexByte(n & 255)}${body}`
}

/** A certificate of FULL_DER's fields with `issuer`, `alg` (inner and outer), `spki` and `tail` after the key. */
const compose = (issuer: string, alg: string, spki: string, tail: string): string =>
  der(
    "30",
    der("30", `${FULL_VERSION}${FULL_SERIAL}${alg}${issuer}${FULL_VALIDITY}${FULL_SUBJECT}${spki}${tail}`) +
      alg +
      FULL_SIGNATURE
  )

/** FULL_DER with `exts`, the concatenated Extension elements, as its whole `[3]`. */
const withExtensions = (exts: string): string =>
  compose(FULL_ISSUER, FULL_ALGORITHM, FULL_SPKI, der("a3", der("30", exts)))

/** One Extension: `oid`'s contents, DER's TRUE when `critical`, and `value` as the extnValue's contents. */
const ext = (oid: string, critical: boolean, value: string): string =>
  der("30", der("06", oid) + (critical ? "0101ff" : "") + der("04", value))

const OID_SAN: string = "551d11"
const OID_BC: string = "551d13"
const OID_KU: string = "551d0f"
const OID_EKU: string = "551d25"
const OID_NC: string = "551d1e"
const OID_SKI: string = "551d0e"
const OID_AKI: string = "551d23"

const read = (hex: string): X509Certificate | null => x509ParseCertificate(fromHex(hex))
const reads = (hex: string): boolean => read(hex) !== null

/** FULL_DER with only the one extension `oid` holding `value`, read back. */
const readOne = (oid: string, critical: boolean, value: string): X509Certificate | null =>
  read(withExtensions(ext(oid, critical, value)))
const readsOne = (oid: string, value: string): boolean => readOne(oid, false, value) !== null

/** Whether FULL_DER with only `oid` read back with unknownCritical set; false when refused. */
const unknownCriticalOf = (oid: string, critical: boolean, value: string): boolean => {
  const c: X509Certificate | null = readOne(oid, critical, value)
  return c !== null && c.unknownCritical
}

/** A sound refusal pair: `good` reads and `bad`, the same with one thing broken, does not. */
const refuses = (t: Suite, name: string, good: boolean, bad: boolean): void => {
  t.ok(`${name}: the sound encoding reads`, good)
  t.ok(`${name}: refused`, !bad)
}

const subtreeText = (s: X509GeneralSubtree): string => {
  if (s.kind === X509_GN_DNS) {
    return `dns:${s.dns}`
  }
  if (s.kind === X509_GN_IP) {
    return `ip:${toHex(s.ip)}/${toHex(s.mask)}`
  }
  if (s.kind === X509_GN_DIR) {
    return `dir:${toHex(s.dirName)}`
  }
  return `other:${s.kind}`
}

const subtreesText = (trees: X509GeneralSubtree[]): string => {
  const parts: string[] = []
  for (const s of trees) {
    parts.push(subtreeText(s))
  }
  return parts.join(" ")
}

const ipsText = (ips: u8[][]): string => {
  const parts: string[] = []
  for (const ip of ips) {
    parts.push(toHex(ip))
  }
  return parts.join(" ")
}

/** Every extension FULL_DER carries, in its order. */
const FULL_EXTENSIONS: string =
  FULL_EXT_BASIC_CONSTRAINTS +
  FULL_EXT_KEY_USAGE +
  FULL_EXT_EXT_KEY_USAGE +
  FULL_EXT_SUBJECT_ALT_NAME +
  FULL_EXT_NAME_CONSTRAINTS +
  FULL_EXT_SUBJECT_KEY_ID +
  FULL_EXT_AUTHORITY_KEY_ID

const fullSuite = (): i32 => {
  const t = new Suite("x509 every decoded extension")
  t.eqStr("FULL_DER composed from its parts is FULL_DER", withExtensions(FULL_EXTENSIONS), FULL_DER)
  const c: X509Certificate | null = read(FULL_DER)
  if (c === null) {
    t.fail("OpenSSL's certificate with every decoded extension reads", "null")
    return t.done()
  }
  t.pass("OpenSSL's certificate with every decoded extension reads")
  t.eqStr("its hash is OpenSSL's", toHex(x509CertificateHash(c.der)), FULL_SHA256)
  t.eqI32("v3", c.version, 2)
  t.eqI32("ecdsa-with-SHA384", c.sigAlg, X509_SIG_ECDSA_SHA384)
  t.eqI32("a P-256 key", c.keyType, X509_KEY_P256)
  t.ok("p256, and not ecdsaSha256", c.p256 && !c.ecdsaSha256)

  t.ok("subjectAltName present", c.sanPresent)
  t.eqStr("its dNSNames, in order and as encoded", c.sanDns.join(","), "example.test,*.example.test")
  t.eqStr("its iPAddresses, v4 and v6", ipsText(c.sanIp), "c0000201 20010db8000000000000000000000001")
  t.eqI32("its rfc822Name counted as another form", c.sanOther, 1)

  t.ok("basicConstraints present", c.bcPresent)
  t.ok("cA", c.bcCa)
  t.eqI32("pathLenConstraint 0", c.bcPathLen, 0)
  t.eqI32("keyUsage digitalSignature and keyCertSign", c.keyUsage, X509_KU_DIGITAL_SIGNATURE | X509_KU_KEY_CERT_SIGN)
  t.ok("extKeyUsage present", c.ekuPresent)
  t.ok("it names serverAuth", c.ekuServerAuth)
  t.eqBool("it does not name anyExtendedKeyUsage", c.ekuAny, false)

  t.ok("nameConstraints present", c.ncPresent)
  t.eqStr(
    "its permittedSubtrees, in order",
    subtreesText(c.ncPermitted),
    "dns:example.test ip:c0000200/ffffff00 dir:300f310d300b060355040a0c046e697368"
  )
  t.eqStr("its excludedSubtrees", subtreesText(c.ncExcluded), "dns:bad.example.test")
  t.eqBool("nothing it cannot express", c.ncUnsupported, false)

  t.eqStr("subjectKeyIdentifier", toHex(c.skid), "1e139d8d6d47fcd32f9f6bd63d47aaa60a506581")
  t.eqStr("authorityKeyIdentifier's keyIdentifier", toHex(c.akid), "76065dfe8df5cb667d430333830c53fea3caa0a4")
  t.eqBool("no unknown critical extension", c.unknownCritical, false)

  const ca: X509Certificate | null = read(P384_CA_DER)
  if (ca === null) {
    t.fail("its P-384 CA reads", "null")
    return t.done()
  }
  t.eqStr("its akid is its CA's skid", toHex(c.akid), toHex(ca.skid))
  t.ok("its issuer is its CA's subject", x509NameEqual(c.issuer, ca.subject))
  t.eqBool("its subject is not its CA's", x509NameEqual(c.subject, ca.subject), false)

  const extensionNames: string[] = ["basicConstraints", "keyUsage", "extKeyUsage", "subjectAltName", "nameConstraints", "subjectKeyIdentifier", "authorityKeyIdentifier"]
  const extensions: string[] = [
    FULL_EXT_BASIC_CONSTRAINTS,
    FULL_EXT_KEY_USAGE,
    FULL_EXT_EXT_KEY_USAGE,
    FULL_EXT_SUBJECT_ALT_NAME,
    FULL_EXT_NAME_CONSTRAINTS,
    FULL_EXT_SUBJECT_KEY_ID,
    FULL_EXT_AUTHORITY_KEY_ID,
  ]
  for (let i: i32 = 0; i < toI32(extensions.length); i++) {
    t.ok(
      `a second ${extensionNames[i]} is refused`,
      !reads(withExtensions(FULL_EXTENSIONS + extensions[i]))
    )
  }
  return t.done()
}

const fixtureSuite = (): i32 => {
  const t = new Suite("x509 Web PKI algorithms and keys")
  const rsa: X509Certificate | null = read(RSA_DER)
  const pss: X509Certificate | null = read(PSS_DER)
  const ca: X509Certificate | null = read(P384_CA_DER)
  const edLeaf: X509Certificate | null = read(ED25519_LEAF_DER)
  const edCa: X509Certificate | null = read(ED25519_CA_DER)
  const crit: X509Certificate | null = read(CRITICAL_DER)
  if (rsa === null || pss === null || ca === null || edLeaf === null || edCa === null || crit === null) {
    t.fail("every OpenSSL fixture reads", "a null")
    return t.done()
  }
  t.pass("every OpenSSL fixture reads")

  t.eqI32("RSA-2048: sha256WithRSAEncryption", rsa.sigAlg, X509_SIG_RSA_PKCS1_SHA256)
  t.eqI32("RSA-2048: an RSA key", rsa.keyType, X509_KEY_RSA)
  t.ok("RSA-2048: a CA with no path length", rsa.bcCa && rsa.bcPathLen === -1)
  t.eqStr("RSA-2048: self-signed, so its akid is its skid", toHex(rsa.akid), toHex(rsa.skid))

  t.eqI32("PSS: v1", pss.version, 0)
  t.eqI32("PSS: RSASSA-PSS", pss.sigAlg, X509_SIG_RSA_PSS)
  t.eqI32("PSS: over SHA-256", pss.pssHash, X509_HASH_SHA256)
  t.eqI32("PSS: a 32-octet salt", pss.pssSaltLen, 32)
  t.eqI32("PSS: an RSA key", pss.keyType, X509_KEY_RSA)
  t.ok("PSS: no extensions, so none present", !pss.bcPresent && !pss.sanPresent && pss.keyUsage === -1)
  t.ok("PSS: issued by the RSA-2048 CA", x509NameEqual(pss.issuer, rsa.subject))

  t.eqI32("P-384 CA: ecdsa-with-SHA384", ca.sigAlg, X509_SIG_ECDSA_SHA384)
  t.eqI32("P-384 CA: a P-384 key", ca.keyType, X509_KEY_P384)
  t.ok("P-384 CA: not p256", !ca.p256)
  t.ok("P-384 CA: cA with pathLenConstraint 1", ca.bcCa && ca.bcPathLen === 1)
  t.eqI32("P-384 CA: keyCertSign and cRLSign", ca.keyUsage, X509_KU_KEY_CERT_SIGN | X509_KU_CRL_SIGN)
  t.ok("P-384 CA: no extKeyUsage", !ca.ekuPresent)

  t.eqI32("Ed25519 leaf: ecdsa-with-SHA384 from its CA", edLeaf.sigAlg, X509_SIG_ECDSA_SHA384)
  t.eqI32("Ed25519 leaf: an Ed25519 key", edLeaf.keyType, X509_KEY_ED25519)
  t.ok("Ed25519 leaf: issued by the P-384 CA", x509NameEqual(edLeaf.issuer, ca.subject))
  t.eqI32("Ed25519 CA: Ed25519", edCa.sigAlg, X509_SIG_ED25519)
  t.eqI32("Ed25519 CA: an Ed25519 key", edCa.keyType, X509_KEY_ED25519)

  t.ok("a critical private extension sets unknownCritical", crit.unknownCritical)
  t.eqStr("and the rest is still read", crit.sanDns.join(","), "crit.example.test")
  t.ok(
    "the same extension not critical leaves it clear",
    !unknownCriticalOf("2b0601040183b2030101", false, "0500") && readsOne("2b0601040183b2030101", "0500")
  )
  t.ok(
    "an unknown critical arc under 2.5.29 sets it too",
    unknownCriticalOf("551d20", true, "3000")
  )

  // The golden certificate, minted by this module, reads as it did before
  // extensions were decoded, and says what its two extensions hold.
  const blocks: u8[][] | null = pemToDer(GOLDEN_PEM, "CERTIFICATE")
  const golden: X509Certificate | null = blocks === null ? null : x509ParseCertificate(blocks[0])
  if (golden === null) {
    t.fail("the golden certificate reads", "null")
    return t.done()
  }
  t.ok("golden: p256 and ecdsaSha256 as before", golden.p256 && golden.ecdsaSha256)
  t.eqI32("golden: ecdsa-with-SHA256", golden.sigAlg, X509_SIG_ECDSA_SHA256)
  t.eqI32("golden: a P-256 key", golden.keyType, X509_KEY_P256)
  t.ok("golden: basicConstraints, not a CA", golden.bcPresent && !golden.bcCa && golden.bcPathLen === -1)
  t.eqI32("golden: keyUsage digitalSignature", golden.keyUsage, X509_KU_DIGITAL_SIGNATURE)
  t.ok("golden: no name, purpose or key id", !golden.sanPresent && !golden.ekuPresent && !golden.ncPresent && golden.skid === null)
  return t.done()
}

const SHA256_OID: string = "608648016503040201"
const SHA384_OID: string = "608648016503040202"
const SHA512_OID: string = "608648016503040203"
const PSS_OID: string = "2a864886f70d01010a"
const MGF1_OID: string = "2a864886f70d010108"

/** A hash AlgorithmIdentifier, with its NULL parameters. */
const hashAlg = (oid: string): string => der("30", der("06", oid) + "0500")

/** RSASSA-PSS-params: `[0]` hash, `[1]` MGF1 over `mgf`, then `rest`. */
const pssParams = (hash: string, mgf: string, rest: string): string =>
  der("30", der("a0", hash) + der("a1", der("30", der("06", MGF1_OID) + mgf)) + rest)

const pssAlg = (params: string): string => der("30", der("06", PSS_OID) + params)

/** FULL_DER's fields under the signature algorithm `alg`, with no extensions. */
const withAlg = (alg: string): X509Certificate | null => read(compose(FULL_ISSUER, alg, FULL_SPKI, ""))

const sigAlgOf = (alg: string): i32 => {
  const c: X509Certificate | null = withAlg(alg)
  return c === null ? -1 : c.sigAlg
}

const keyTypeOf = (keyAlg: string): i32 => {
  const c: X509Certificate | null = read(compose(FULL_ISSUER, FULL_ALGORITHM, der("30", keyAlg + der("03", "000102")), ""))
  return c === null ? -1 : c.keyType
}

const algorithmSuite = (): i32 => {
  const t = new Suite("x509 signature algorithms and key types")
  const salt32: string = der("a2", "020120")
  const h256: string = hashAlg(SHA256_OID)
  t.eqStr("PSS_DER's algorithm composed here is OpenSSL's", pssAlg(pssParams(h256, h256, salt32)), toHex(fromHex(
    "304106092a864886f70d01010a3034a00f300d06096086480165030402010500a11c301a06092a864886f70d010108300d06096086480165030402010500a203020120"
  )))
  const sound: X509Certificate | null = withAlg(pssAlg(pssParams(h256, h256, salt32)))
  t.ok("PSS: SHA-256, salt 32", sound !== null && sound.sigAlg === X509_SIG_RSA_PSS && sound.pssHash === X509_HASH_SHA256 && sound.pssSaltLen === 32)
  const salt20: X509Certificate | null = withAlg(pssAlg(pssParams(h256, h256, "")))
  t.ok("PSS: an absent salt length is 20", salt20 !== null && salt20.sigAlg === X509_SIG_RSA_PSS && salt20.pssSaltLen === 20)
  const h512: string = hashAlg(SHA512_OID)
  const sha512: X509Certificate | null = withAlg(pssAlg(pssParams(h512, h512, der("a2", "020140"))))
  t.ok("PSS: SHA-512, salt 64", sha512 !== null && sha512.pssHash === X509_HASH_SHA512 && sha512.pssSaltLen === 64)
  const bare: string = der("30", der("06", SHA256_OID))
  t.eqI32("PSS: a hash with absent parameters", sigAlgOf(pssAlg(pssParams(bare, bare, salt32))), X509_SIG_RSA_PSS)

  // Each of these reads, as a certificate, with an algorithm no verifier may
  // take for RSASSA-PSS over SHA-2.
  t.eqI32("PSS: an MGF1 hash that is not the message's", sigAlgOf(pssAlg(pssParams(h256, hashAlg(SHA384_OID), salt32))), X509_SIG_UNKNOWN)
  t.eqI32(
    "PSS: no [0], so SHA-1 by default",
    sigAlgOf(pssAlg(der("30", der("a1", der("30", der("06", MGF1_OID) + h256)) + salt32))),
    X509_SIG_UNKNOWN
  )
  t.eqI32("PSS: SHA-1 named", sigAlgOf(pssAlg(pssParams(hashAlg("2b0e03021a"), hashAlg("2b0e03021a"), salt32))), X509_SIG_UNKNOWN)
  t.eqI32(
    "PSS: a mask that is not MGF1",
    sigAlgOf(pssAlg(der("30", der("a0", h256) + der("a1", der("30", der("06", "2a864886f70d010109") + h256)) + salt32))),
    X509_SIG_UNKNOWN
  )
  t.eqI32("PSS: a negative salt length", sigAlgOf(pssAlg(pssParams(h256, h256, der("a2", "020180")))), X509_SIG_UNKNOWN)
  t.eqI32("PSS: trailerField 1, the DEFAULT, written out", sigAlgOf(pssAlg(pssParams(h256, h256, salt32 + der("a3", "020101")))), X509_SIG_UNKNOWN)
  t.eqI32("PSS: a salt length of 20, the DEFAULT, written out", sigAlgOf(pssAlg(pssParams(h256, h256, der("a2", "020114")))), X509_SIG_UNKNOWN)
  t.eqI32("PSS: trailerField 2", sigAlgOf(pssAlg(pssParams(h256, h256, salt32 + der("a3", "020102")))), X509_SIG_UNKNOWN)
  t.eqI32("PSS: an element after the trailer", sigAlgOf(pssAlg(pssParams(h256, h256, salt32 + "0500"))), X509_SIG_UNKNOWN)
  t.eqI32("PSS: parameters absent", sigAlgOf(der("30", der("06", PSS_OID))), X509_SIG_UNKNOWN)
  t.eqI32("PSS: parameters NULL", sigAlgOf(der("30", der("06", PSS_OID) + "0500")), X509_SIG_UNKNOWN)

  t.eqI32("sha256WithRSAEncryption with NULL", sigAlgOf(hashAlg("2a864886f70d01010b")), X509_SIG_RSA_PKCS1_SHA256)
  t.eqI32("sha384WithRSAEncryption with NULL", sigAlgOf(hashAlg("2a864886f70d01010c")), X509_SIG_RSA_PKCS1_SHA384)
  t.eqI32("sha512WithRSAEncryption with NULL", sigAlgOf(hashAlg("2a864886f70d01010d")), X509_SIG_RSA_PKCS1_SHA512)
  t.eqI32("sha1WithRSAEncryption with NULL", sigAlgOf(hashAlg("2a864886f70d010105")), X509_SIG_RSA_PKCS1_SHA1)
  t.eqI32("sha256WithRSAEncryption with its NULL absent", sigAlgOf(der("30", der("06", "2a864886f70d01010b"))), X509_SIG_UNKNOWN)
  t.eqI32("ecdsa-with-SHA256 absent", sigAlgOf(der("30", der("06", "2a8648ce3d040302"))), X509_SIG_ECDSA_SHA256)
  t.eqI32("ecdsa-with-SHA256 with a NULL", sigAlgOf(hashAlg("2a8648ce3d040302")), X509_SIG_UNKNOWN)
  t.eqI32("ecdsa-with-SHA384 with a NULL", sigAlgOf(hashAlg("2a8648ce3d040303")), X509_SIG_UNKNOWN)
  t.eqI32("Ed25519 absent", sigAlgOf(der("30", der("06", "2b6570"))), X509_SIG_ED25519)
  t.eqI32("Ed25519 with a NULL", sigAlgOf(hashAlg("2b6570")), X509_SIG_UNKNOWN)

  const ec: string = der("06", "2a8648ce3d0201")
  t.eqI32("id-ecPublicKey on prime256v1", keyTypeOf(der("30", ec + der("06", "2a8648ce3d030107"))), X509_KEY_P256)
  t.eqI32("id-ecPublicKey on secp384r1", keyTypeOf(der("30", ec + der("06", "2b81040022"))), X509_KEY_P384)
  t.eqI32("id-ecPublicKey on secp521r1", keyTypeOf(der("30", ec + der("06", "2b81040023"))), X509_KEY_UNKNOWN)
  t.eqI32("rsaEncryption with NULL", keyTypeOf(hashAlg("2a864886f70d010101")), X509_KEY_RSA)
  t.eqI32("rsaEncryption with its NULL absent", keyTypeOf(der("30", der("06", "2a864886f70d010101"))), X509_KEY_UNKNOWN)
  t.eqI32("Ed25519 absent", keyTypeOf(der("30", der("06", "2b6570"))), X509_KEY_ED25519)
  t.eqI32("Ed25519 with a NULL", keyTypeOf(hashAlg("2b6570")), X509_KEY_UNKNOWN)
  return t.done()
}

/** A subjectAltName of the one dNSName "a.test". */
const SAN_GOOD: string = "30088206612e74657374"

const extensionSuite = (): i32 => {
  const t = new Suite("x509 extension refusals")
  const bc: string = der("30", "")
  const goodBc: string = ext(OID_BC, true, bc)
  t.ok("one extension alone reads", reads(withExtensions(goodBc)))
  refuses(t, "an empty extensions SEQUENCE", reads(withExtensions(goodBc)), reads(withExtensions("")))
  refuses(
    t,
    "an extnID with a padded subidentifier",
    readsOne("2b0601040183b2030101", "0500"),
    readsOne("2b060104018083b2030101", "0500")
  )
  refuses(t, "an extnID whose last octet continues", readsOne("2a0303", "0500"), readsOne("2a0383", "0500"))
  refuses(
    t,
    "an empty extnID",
    readsOne("2a0303", "0500"),
    reads(withExtensions(der("30", "0600" + der("04", "0500"))))
  )
  t.ok("an OID outside 2.5.29 ending in basicConstraints' arc is not basicConstraints", readsOne("2a0313", "0500"))
  refuses(
    t,
    "a duplicate extension",
    reads(withExtensions(goodBc + ext(OID_KU, true, "03020780"))),
    reads(withExtensions(goodBc + ext(OID_BC, false, bc)))
  )
  refuses(
    t,
    "a duplicate unknown extension",
    reads(withExtensions(ext("2a0304", false, "0500") + ext("2a0305", false, "0500"))),
    reads(withExtensions(ext("2a0304", false, "0500") + ext("2a0304", false, "0500")))
  )
  refuses(
    t,
    "critical spelled FALSE, which DER leaves out",
    reads(withExtensions(goodBc)),
    reads(withExtensions(der("30", der("06", OID_BC) + "010100" + der("04", bc))))
  )
  refuses(
    t,
    "critical spelled 01 rather than ff",
    reads(withExtensions(goodBc)),
    reads(withExtensions(der("30", der("06", OID_BC) + "010101" + der("04", bc))))
  )
  refuses(
    t,
    "an element after extnValue",
    reads(withExtensions(goodBc)),
    reads(withExtensions(der("30", der("06", OID_BC) + "0101ff" + der("04", bc) + "0500")))
  )
  refuses(
    t,
    "an extnValue that is not an OCTET STRING",
    reads(withExtensions(goodBc)),
    reads(withExtensions(der("30", der("06", OID_BC) + "0101ff" + der("03", "00" + bc))))
  )
  refuses(t, "a decoded value with trailing bytes", readsOne(OID_BC, bc), readsOne(OID_BC, bc + "0500"))

  refuses(t, "an empty subjectAltName", readsOne(OID_SAN, SAN_GOOD), readsOne(OID_SAN, der("30", "")))
  refuses(t, "a 5-octet iPAddress", readsOne(OID_SAN, der("30", der("87", "c0000201"))), readsOne(OID_SAN, der("30", der("87", "c000020100"))))
  refuses(t, "a dNSName with an octet above 0x7f", readsOne(OID_SAN, SAN_GOOD), readsOne(OID_SAN, der("30", der("82", "612ef4657374"))))
  refuses(t, "a dNSName with a NUL", readsOne(OID_SAN, SAN_GOOD), readsOne(OID_SAN, der("30", der("82", "61002e74657374"))))
  refuses(t, "an rfc822Name that is not IA5", readsOne(OID_SAN, der("30", der("81", "6140622e63"))), readsOne(OID_SAN, der("30", der("81", "61c0622e63"))))
  refuses(t, "an empty dNSName", readsOne(OID_SAN, SAN_GOOD), readsOne(OID_SAN, der("30", der("82", ""))))
  const otherName: string = der("a0", der("06", "2a03") + der("a0", der("0c", "61")))
  refuses(t, "an otherName that is not an OID and a value", readsOne(OID_SAN, der("30", otherName)), readsOne(OID_SAN, der("30", der("a0", "ffff"))))
  refuses(t, "an otherName with a padded type-id", readsOne(OID_SAN, der("30", otherName)), readsOne(OID_SAN, der("30", der("a0", der("06", "2a8003") + der("a0", der("0c", "61"))))))
  refuses(t, "an otherName with bytes after its value", readsOne(OID_SAN, der("30", otherName)), readsOne(OID_SAN, der("30", der("a0", der("06", "2a03") + der("a0", der("0c", "61")) + "0500"))))
  refuses(t, "a registeredID whose last octet continues", readsOne(OID_SAN, der("30", der("88", "2a03"))), readsOne(OID_SAN, der("30", der("88", "2a83"))))
  refuses(t, "a GeneralName tag no form has", readsOne(OID_SAN, SAN_GOOD), readsOne(OID_SAN, der("30", der("89", "00"))))
  refuses(t, "a dNSName tagged constructed", readsOne(OID_SAN, SAN_GOOD), readsOne(OID_SAN, der("30", der("a2", der("16", "61")))))
  refuses(
    t,
    "a directoryName that is not a sound Name",
    readsOne(OID_SAN, der("30", der("a4", FULL_SUBJECT))),
    readsOne(OID_SAN, der("30", der("a4", der("30", der("31", "")))))
  )

  const path3: X509Certificate | null = readOne(OID_BC, true, der("30", "0101ff020103"))
  t.ok("cA and pathLen 3 read", path3 !== null && path3.bcPathLen === 3)
  refuses(t, "a negative pathLenConstraint", readsOne(OID_BC, der("30", "0101ff02017f")), readsOne(OID_BC, der("30", "0101ff020180")))
  refuses(t, "a non-minimal pathLenConstraint", readsOne(OID_BC, der("30", "0101ff020100")), readsOne(OID_BC, der("30", "0101ff02020001")))
  refuses(t, "a pathLenConstraint of 2^31", readsOne(OID_BC, der("30", "0101ff02047fffffff")), readsOne(OID_BC, der("30", "0101ff02050080000000")))
  refuses(t, "a pathLenConstraint of 2^32 + 1, which 32 bits read as 1", readsOne(OID_BC, der("30", "0101ff020101")), readsOne(OID_BC, der("30", "0101ff02050100000001")))
  refuses(t, "a pathLenConstraint that is not an INTEGER", readsOne(OID_BC, der("30", "0101ff020100")), readsOne(OID_BC, der("30", "0101ff0a0100")))
  refuses(t, "cA spelled FALSE", readsOne(OID_BC, bc), readsOne(OID_BC, der("30", "010100")))
  refuses(t, "cA spelled 01", readsOne(OID_BC, der("30", "0101ff")), readsOne(OID_BC, der("30", "010101")))
  refuses(t, "an element after pathLenConstraint", readsOne(OID_BC, der("30", "0101ff020100")), readsOne(OID_BC, der("30", "0101ff0201000500")))

  const decipher: X509Certificate | null = readOne(OID_KU, true, "0303070080")
  t.ok("keyUsage decipherOnly, bit 8", decipher !== null && decipher.keyUsage === 256)
  refuses(t, "a keyUsage with no bit set", readsOne(OID_KU, "03020780"), readsOne(OID_KU, "030100"))
  refuses(t, "a keyUsage with a trailing zero bit", readsOne(OID_KU, "03020780"), readsOne(OID_KU, "03020080"))
  refuses(t, "a keyUsage of three octets", readsOne(OID_KU, "0303070080"), readsOne(OID_KU, "030407800080"))
  refuses(t, "a keyUsage bit past decipherOnly", readsOne(OID_KU, "0303070080"), readsOne(OID_KU, "0303060040"))
  refuses(t, "a keyUsage with an unused bit set", readsOne(OID_KU, "03020780"), readsOne(OID_KU, "03020781"))

  const serverAuth: string = der("06", "2b06010505070301")
  const ekuAny: X509Certificate | null = readOne(OID_EKU, false, der("30", der("06", "551d2500")))
  t.ok("anyExtendedKeyUsage read", ekuAny !== null && ekuAny.ekuAny && !ekuAny.ekuServerAuth)
  refuses(t, "an empty extKeyUsage", readsOne(OID_EKU, der("30", serverAuth)), readsOne(OID_EKU, der("30", "")))
  refuses(t, "an extKeyUsage holding a NULL", readsOne(OID_EKU, der("30", serverAuth)), readsOne(OID_EKU, der("30", serverAuth + "0500")))
  refuses(t, "an extKeyUsage with a padded OID", readsOne(OID_EKU, der("30", serverAuth)), readsOne(OID_EKU, der("30", der("06", "2b0601058005070301"))))

  const dnsTree: string = der("30", der("82", "612e74657374"))
  const nc: X509Certificate | null = readOne(OID_NC, true, der("30", der("a1", dnsTree)))
  t.ok("excluded only", nc !== null && toI32(nc.ncPermitted.length) === 0 && toI32(nc.ncExcluded.length) === 1)
  refuses(t, "an empty nameConstraints", readsOne(OID_NC, der("30", der("a0", dnsTree))), readsOne(OID_NC, der("30", "")))
  refuses(t, "an empty permittedSubtrees", readsOne(OID_NC, der("30", der("a0", dnsTree))), readsOne(OID_NC, der("30", der("a0", ""))))
  refuses(t, "an empty excludedSubtrees", readsOne(OID_NC, der("30", der("a1", dnsTree))), readsOne(OID_NC, der("30", der("a1", ""))))
  refuses(
    t,
    "an iPAddress subtree of 5 octets",
    readsOne(OID_NC, der("30", der("a0", der("30", der("87", "c0000200ffffff00"))))),
    readsOne(OID_NC, der("30", der("a0", der("30", der("87", "c0000200ff")))))
  )
  refuses(
    t,
    "an iPAddress subtree of 6 octets with a contiguous mask",
    readsOne(OID_NC, der("30", der("a0", der("30", der("87", "c0000200ffffff00"))))),
    readsOne(OID_NC, der("30", der("a0", der("30", der("87", "c00002ffff00")))))
  )
  refuses(
    t,
    "an iPAddress mask that is not contiguous",
    readsOne(OID_NC, der("30", der("a0", der("30", der("87", "c0000200ffff0000"))))),
    readsOne(OID_NC, der("30", der("a0", der("30", der("87", "c0000200ff00ff00")))))
  )
  refuses(t, "a subtree base tag no form has", readsOne(OID_NC, der("30", der("a0", dnsTree))), readsOne(OID_NC, der("30", der("a0", der("30", der("89", "00"))))))
  refuses(t, "a subtree that is not a SEQUENCE", readsOne(OID_NC, der("30", der("a0", dnsTree))), readsOne(OID_NC, der("30", der("a0", der("31", der("82", "61"))))))
  refuses(t, "an element after excludedSubtrees", readsOne(OID_NC, der("30", der("a1", dnsTree))), readsOne(OID_NC, der("30", der("a1", dnsTree) + "0500")))
  refuses(t, "excludedSubtrees before permittedSubtrees", readsOne(OID_NC, der("30", der("a0", dnsTree) + der("a1", dnsTree))), readsOne(OID_NC, der("30", der("a1", dnsTree) + der("a0", dnsTree))))
  const minimum: X509Certificate | null = readOne(OID_NC, true, der("30", der("a0", der("30", der("82", "61") + der("80", "01")))))
  t.ok("a subtree with a minimum is unsupported", minimum !== null && minimum.ncUnsupported)
  const maximum: X509Certificate | null = readOne(OID_NC, true, der("30", der("a0", der("30", der("82", "61") + der("81", "02")))))
  t.ok("a subtree with a maximum is unsupported", maximum !== null && maximum.ncUnsupported)
  refuses(t, "a subtree minimum of 0, the DEFAULT, written out", readsOne(OID_NC, der("30", der("a0", dnsTree))), readsOne(OID_NC, der("30", der("a0", der("30", der("82", "61") + der("80", "00"))))))
  refuses(t, "a non-minimal subtree minimum", readsOne(OID_NC, der("30", der("a0", der("30", der("82", "61") + der("80", "01"))))), readsOne(OID_NC, der("30", der("a0", der("30", der("82", "61") + der("80", "0001"))))))
  refuses(t, "a negative subtree maximum", readsOne(OID_NC, der("30", der("a0", der("30", der("82", "61") + der("81", "7f"))))), readsOne(OID_NC, der("30", der("a0", der("30", der("82", "61") + der("81", "80"))))))
  refuses(t, "an element after a subtree's base", readsOne(OID_NC, der("30", der("a0", dnsTree))), readsOne(OID_NC, der("30", der("a0", der("30", der("82", "61") + "0500")))))
  refuses(t, "a maximum before a minimum", readsOne(OID_NC, der("30", der("a0", der("30", der("82", "61") + der("80", "01") + der("81", "02"))))), readsOne(OID_NC, der("30", der("a0", der("30", der("82", "61") + der("81", "02") + der("80", "01"))))))
  const other: X509Certificate | null = readOne(OID_NC, true, der("30", der("a0", der("30", der("86", "687474703a2f2f61")))))
  t.ok("a URI subtree is unsupported", other !== null && other.ncUnsupported)

  refuses(t, "a subjectKeyIdentifier that is not an OCTET STRING", readsOne(OID_SKI, der("04", "0102")), readsOne(OID_SKI, der("03", "000102")))
  refuses(t, "an empty subjectKeyIdentifier", readsOne(OID_SKI, der("04", "01")), readsOne(OID_SKI, der("04", "")))
  refuses(t, "an empty keyIdentifier", readsOne(OID_AKI, der("30", der("80", "01"))), readsOne(OID_AKI, der("30", der("80", ""))))
  const issuerSerial: string = der("a1", der("a4", FULL_ISSUER)) + der("82", "01")
  refuses(t, "an empty authorityCertIssuer", readsOne(OID_AKI, der("30", issuerSerial)), readsOne(OID_AKI, der("30", der("a1", "") + der("82", "01"))))
  refuses(t, "an authorityCertIssuer that is not GeneralNames", readsOne(OID_AKI, der("30", issuerSerial)), readsOne(OID_AKI, der("30", der("a1", der("89", "00")) + der("82", "01"))))
  refuses(t, "a non-minimal authorityCertSerialNumber", readsOne(OID_AKI, der("30", issuerSerial)), readsOne(OID_AKI, der("30", der("a1", der("a4", FULL_ISSUER)) + der("82", "0001"))))
  refuses(t, "an authorityCertIssuer with no serial", readsOne(OID_AKI, der("30", issuerSerial)), readsOne(OID_AKI, der("30", der("a1", der("a4", FULL_ISSUER)))))
  refuses(t, "an authorityCertSerialNumber with no issuer", readsOne(OID_AKI, der("30", der("80", "01") + issuerSerial)), readsOne(OID_AKI, der("30", der("80", "01") + der("82", "01"))))
  refuses(t, "an authorityKeyIdentifier with trailing bytes", readsOne(OID_AKI, der("30", der("80", "01"))), readsOne(OID_AKI, der("30", der("80", "01") + "0500")))
  refuses(t, "an authorityKeyIdentifier that is not a SEQUENCE", readsOne(OID_AKI, der("30", der("80", "01"))), readsOne(OID_AKI, der("31", der("80", "01"))))
  return t.done()
}

const nameSuite = (): i32 => {
  const t = new Suite("x509 Names")
  const cn: string = der("30", der("06", "550403") + der("0c", "61"))
  const o: string = der("30", der("06", "55040a") + der("0c", "6e697368"))
  refuses(
    t,
    "an issuer with an empty RDN",
    reads(compose(der("30", der("31", cn)), FULL_ALGORITHM, FULL_SPKI, "")),
    reads(compose(der("30", der("31", cn) + der("31", "")), FULL_ALGORITHM, FULL_SPKI, ""))
  )
  refuses(
    t,
    "an attribute with no value",
    reads(compose(der("30", der("31", cn)), FULL_ALGORITHM, FULL_SPKI, "")),
    reads(compose(der("30", der("31", der("30", der("06", "550403")))), FULL_ALGORITHM, FULL_SPKI, ""))
  )
  refuses(
    t,
    "an attribute with an element after its value",
    reads(compose(der("30", der("31", cn)), FULL_ALGORITHM, FULL_SPKI, "")),
    reads(compose(der("30", der("31", der("30", der("06", "550403") + der("0c", "61") + "0500"))), FULL_ALGORITHM, FULL_SPKI, ""))
  )
  t.ok("a multi-valued RDN reads", reads(compose(der("30", der("31", o + cn)), FULL_ALGORITHM, FULL_SPKI, "")))
  refuses(
    t,
    "an attribute with a padded type OID",
    reads(compose(der("30", der("31", cn)), FULL_ALGORITHM, FULL_SPKI, "")),
    reads(compose(der("30", der("31", der("30", der("06", "55800403") + der("0c", "61")))), FULL_ALGORITHM, FULL_SPKI, ""))
  )

  const base: u8[] = fromHex(der("30", der("31", o)))
  const name: u8[] = fromHex(FULL_SUBJECT)
  t.ok("O=nish is a prefix of O=nish, CN=nish-fixture-full", x509NameIsPrefix(base, name))
  t.eqBool("not the other way about", x509NameIsPrefix(name, base), false)
  t.ok("a Name is a prefix of itself", x509NameIsPrefix(name, name))
  t.ok("the empty Name is a prefix of every Name", x509NameIsPrefix(fromHex("3000"), name))
  t.eqBool("CN=a is not a prefix of O=nish, ...", x509NameIsPrefix(fromHex(der("30", der("31", cn))), name), false)
  t.eqBool("an RDN that only starts the same is not a prefix", x509NameIsPrefix(fromHex(der("30", der("31", o))), fromHex(der("30", der("31", o + cn)))), false)
  t.eqBool("a base that is not a Name", x509NameIsPrefix(fromHex(der("30", der("31", ""))), name), false)
  t.eqBool("the empty Name against a name with an empty RDN", x509NameIsPrefix(fromHex("3000"), fromHex("30023100")), false)
  t.eqBool("a name that is not a Name", x509NameIsPrefix(base, fromHex(`${FULL_SUBJECT}00`)), false)
  t.ok("x509NameEqual is byte for byte", x509NameEqual(fromHex(FULL_SUBJECT), name))
  t.eqBool("so UTF8String and PrintableString spellings differ", x509NameEqual(base, fromHex(der("30", der("31", der("30", der("06", "55040a") + der("13", "6e697368")))))), false)
  return t.done()
}

const signatureSuite = (): i32 => {
  const t = new Suite("x509 ECDSA signature widths")
  const full: X509Certificate | null = read(FULL_DER)
  const ca: X509Certificate | null = read(P384_CA_DER)
  if (full === null || ca === null) {
    t.fail("the P-384-signed fixtures read", "null")
    return t.done()
  }
  t.eqStr(
    "FULL_DER's P-384 signature as r || s, 48 octets each",
    toHex(x509DerSignatureRSWidth(full.signature, 48)),
    "44a9fb3f39c6f4c1c0a530664175d78987ea9460d735ae111d18434a773c61289a12316040f1efceba699005dc4c292d" +
      "38d3016f2bdd60f848ef211eb7eb9d7595da99ed1df4227abee3b4aabfff7f2d2dff496489172731c7d5ce7a69ec712a"
  )
  const caRs: u8[] | null = x509DerSignatureRSWidth(ca.signature, 48)
  t.ok("the CA's own, 96 octets", caRs !== null && toI32(caRs.length) === 96)
  t.ok("too wide for P-256", x509DerSignatureRSWidth(full.signature, 32) === null)
  const small: u8[] = fromHex(der("30", der("02", "01") + der("02", "01")))
  t.ok("a small signature at P-256's width", x509DerSignatureRSWidth(small, 32) !== null)
  t.ok("the same at a width that is no curve's", x509DerSignatureRSWidth(small, 40) === null)
  const r49: string = der("02", `01${zeros(48)}`)
  t.ok("an r of 49 octets", x509DerSignatureRSWidth(fromHex(der("30", r49 + der("02", "01"))), 48) === null)
  t.eqStr("a short r and s are padded", toHex(x509DerSignatureRSWidth(fromHex(der("30", der("02", "01") + der("02", "0080"))), 48)), `${zeros(47)}01${zeros(47)}80`)
  t.ok("a negative r", x509DerSignatureRSWidth(fromHex(der("30", der("02", "80") + der("02", "01"))), 48) === null)
  return t.done()
}

/** Every suite here, summed. */
export const webPkiSuites = (): i32 => fullSuite() + fixtureSuite() + algorithmSuite() + extensionSuite() + nameSuite() + signatureSuite()

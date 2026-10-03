// `nish/crypto/x509` against its documents and against OpenSSL.
//
// The golden certificate is minted from RFC 6979 A.2.5's P-256 key, as
// localhost, from 2026-01-01T00:00:00Z for fourteen days, with the serial
// 0123456789abcdef0123456789abcdef, and pinned byte for byte. It was checked by
// hand with OpenSSL 3.0.13 (the PR that added this module has the output):
//
//   openssl x509 -inform DER -in golden.der -noout -text
//     (v3, ecdsa-with-SHA256, CN = localhost, Jan 1 to Jan 15 2026, P-256)
//   openssl x509 -inform DER -in golden.der -out golden.pem
//   openssl verify -x509_strict -attime 1767312000 -CAfile golden.pem golden.pem
//     (golden.pem: OK; `-attime` because its fourteen days are in the past)
//   openssl x509 -inform DER -in golden.der -outform DER | sha256sum
//     (1fbbe716…, GOLDEN_SHA256 below)
//
// Then: the golden read back; the calendar at a leap day, at the 2049/2050
// switch from UTCTime to GeneralizedTime and at the end of 9999; the PEM
// codec's padding, CRLF, other labels and its refusals; OpenSSL's own PKCS#8
// and SEC1 keys and a CA-signed chain (fixtures.ts says how they were made);
// and each refusal the module promises — a truncated DER, non-minimal lengths,
// a wrong PEM label, days 0 and 15, a key on another curve.
import { Suite } from "nish/testing"
import {
  X509_MAX_DAYS,
  X509_MAX_SERIAL,
  X509Certificate,
  derToPem,
  pemToDer,
  x509CertificateHash,
  x509ParseCertificate,
  x509ParseChain,
  x509VerifySignature,
} from "nish/crypto/x509"
import { x509MintSelfSignedPlain as x509MintSelfSigned, x509ParseP256PrivateKeyPlain as x509ParseP256PrivateKey, x509PublicKeyPlain as p256PublicKey } from "./plain"
import {
  BAD_ALGORITHM_MISMATCH,
  BAD_EXTENSIONS_IN_V1,
  BAD_HIGH_TAG,
  BAD_INDEFINITE,
  BAD_LENGTH_OVER_I32,
  BAD_LONG_LENGTH,
  BAD_MONTH_13,
  BAD_SERIAL_PADDED,
  BAD_SHORT_LONG_FORM,
  BAD_TRAILING,
  BAD_TRUNCATED,
  BAD_UNUSED_BITS,
  BAD_VERSION_1,
  CA_NOT_AFTER,
  CA_NOT_BEFORE,
  CA_PEM,
  CA_PKCS8_PEM,
  CA_PRIVATE,
  CA_SEC1_PEM,
  CA_SHA256,
  GOLDEN_PEM,
  KEY_PKCS8,
  KEY_SEC1,
  KEY_SEC1_NO_CURVE,
  KEY_SEC1_ORDER,
  KEY_SEC1_SHORT_LONG_FORM,
  KEY_SEC1_WRONG_PUBLIC,
  KEY_SEC1_ZERO,
  LEAF_NOT_AFTER,
  LEAF_NOT_BEFORE,
  LEAF_PEM,
  LEAF_SHA256,
  P384_PKCS8_PEM,
  P384_SEC1_PEM,
} from "./fixtures"
import { fromHex, toHex } from "./hex"

// RFC 6979 A.2.5.
const PRIVATE: string = "c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721"
const PUBLIC: string =
  "0460fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299"
// The group order n (SEC 2 §2.4.2).
const N: string = "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"

const SERIAL: string = "0123456789abcdef0123456789abcdef"
// 2026-01-01T00:00:00Z, and fourteen days later.
const NOT_BEFORE: i64 = 1767225600000
const NOT_AFTER: i64 = 1768435200000
const GOLDEN: string =
  "308201223081caa00302010202100123456789abcdef0123456789abcdef300a06082a8648ce3d04030230143112301006035504030c096c6f63616c686f7374301e170d3236303130313030303030305a170d3236303131353030303030305a30143112301006035504030c096c6f63616c686f73743059301306072a8648ce3d020106082a8648ce3d0301070342000460fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299300a06082a8648ce3d0403020347003044022041e3cdab220d60d16846a1033a3679f7b0fe54fc74492d8ba72f70817578970302206e840bdbd9eac275a7ca1ca3b39ca8a23e20a06e2d83a076f797bf5a10226506"
const GOLDEN_SHA256: string = "1fbbe71684cc9e604673b2e291046ab6ea08aee7db4f9859e87cce9418978b82"

// 2028-02-28T12:30:15Z, two days before 2028-03-01 across a leap day.
const LEAP: i64 = 1835353815000
// 2049-12-25T00:00:00Z: fourteen days later is 2050, a GeneralizedTime.
const LATE_2049: i64 = 2524003200000
// 9999-12-20T00:00:00Z: eleven days reach 9999-12-31, twelve do not fit.
const LAST_DECEMBER: i64 = 253401264000000

const MS_PER_DAY: i64 = 86400000

/** `count` copies of the byte `value`. */
const repeat = (value: i32, count: i32): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < count; i++) {
    out.push(toU8(value))
  }
  return out
}

/** A string of `count` letters `a`. */
const letters = (count: i32): string => {
  const parts: string[] = []
  for (let i: i32 = 0; i < count; i++) {
    parts.push("a")
  }
  return parts.join("")
}

/** `bytes` with its last byte XORed with 1, in a copy. */
const flipLast = (bytes: u8[]): u8[] => {
  const out: u8[] = []
  const length: i32 = toI32(bytes.length)
  for (let i: i32 = 0; i < length && i < toI32(bytes.length); i++) {
    out.push(i === length - 1 ? bytes[i] ^ toU8(1) : bytes[i])
  }
  return out
}

/** Hex DER as a PEM block with `label`. */
const hexPem = (hex: string, label: string): string => derToPem(fromHex(hex), label)

/** Whether `der` is refused by `x509ParseCertificate`. */
const refused = (der: u8[]): boolean => x509ParseCertificate(der) === null

/** The number of blocks `pemToDer` finds, or -1 for `null`. */
const blockCount = (pem: string, label: string): i32 => {
  const blocks: u8[][] | null = pemToDer(pem, label)
  return blocks === null ? -1 : toI32(blocks.length)
}

/** The hex of the only block `pemToDer` finds, or "null". */
const onlyBlock = (pem: string, label: string): string => {
  const blocks: u8[][] | null = pemToDer(pem, label)
  if (blocks === null || toI32(blocks.length) !== 1) {
    return "null"
  }
  return toHex(blocks[0])
}

/** Mint with the golden's key, name and serial, varying the time and days. */
const mintAt = (notBeforeMs: i64, days: i32): u8[] | null =>
  x509MintSelfSigned(fromHex(PRIVATE), "localhost", notBeforeMs, days, fromHex(SERIAL))

/** Mint with the golden's key, time and days, varying the serial. */
const mintSerial = (serial: u8[]): u8[] | null =>
  x509MintSelfSigned(fromHex(PRIVATE), "localhost", NOT_BEFORE, 14, serial)

/** Mint with the golden's key, time, days and serial, varying the name. */
const mintName = (name: string): u8[] | null =>
  x509MintSelfSigned(fromHex(PRIVATE), name, NOT_BEFORE, 14, fromHex(SERIAL))

/** Whether minting at `notBeforeMs` for `days` reads back as exactly that validity. */
const roundTrips = (notBeforeMs: i64, days: i32): boolean => {
  const der: u8[] | null = mintAt(notBeforeMs, days)
  if (der === null) {
    return false
  }
  const cert: X509Certificate | null = x509ParseCertificate(der)
  return (
    cert !== null && cert.notBefore === notBeforeMs && cert.notAfter === notBeforeMs + toI64(days) * MS_PER_DAY
  )
}

const mintSuite = (): i32 => {
  const t = new Suite("x509 mint")
  const der: u8[] | null = mintAt(NOT_BEFORE, 14)
  t.eqStr("RFC 6979 A.2.5's key, localhost, 2026-01-01, 14 days: the golden DER", toHex(der), GOLDEN)
  t.eqStr("its SHA-256 is OpenSSL's", toHex(x509CertificateHash(fromHex(GOLDEN))), GOLDEN_SHA256)
  t.eqStr("its PEM is OpenSSL's, byte for byte", derToPem(fromHex(GOLDEN), "CERTIFICATE"), GOLDEN_PEM)
  t.eqStr("milliseconds are rounded down to the second", toHex(mintAt(NOT_BEFORE + 999, 14)), GOLDEN)
  t.eqI32("X509_MAX_DAYS is fourteen", X509_MAX_DAYS, 14)

  t.eqStr("days 0 answers null", toHex(mintAt(NOT_BEFORE, 0)), "null")
  t.eqStr("days 15 answers null", toHex(mintAt(NOT_BEFORE, 15)), "null")
  t.eqStr("days -1 answers null", toHex(mintAt(NOT_BEFORE, -1)), "null")
  t.ok("days 1 mints", mintAt(NOT_BEFORE, 1) !== null)
  t.eqStr("a time before 1970 answers null", toHex(mintAt(-1, 14)), "null")

  t.ok("across a leap day: 2028-02-28T12:30:15Z + 2 days reads back", roundTrips(LEAP, 2))
  t.ok("2049-12-25 + 14 days, UTCTime then GeneralizedTime, reads back", roundTrips(LATE_2049, 14))
  t.ok("9999-12-20 + 11 days ends on 9999-12-31 and reads back", roundTrips(LAST_DECEMBER, 11))
  t.eqStr("9999-12-20 + 12 days is past 9999 and answers null", toHex(mintAt(LAST_DECEMBER, 12)), "null")

  t.eqI32("X509_MAX_SERIAL is twenty", X509_MAX_SERIAL, 20)
  t.eqStr("leading zeros of the serial are ignored", toHex(mintSerial(fromHex(`0000${SERIAL}`))), GOLDEN)
  t.eqStr("a zero serial answers null", toHex(mintSerial(repeat(0, 4))), "null")
  t.eqStr("an empty serial answers null", toHex(mintSerial([])), "null")
  t.ok("twenty octets, top bit clear, mint", mintSerial(repeat(0x7f, 20)) !== null)
  t.eqStr("twenty octets, top bit set, need 21 and answer null", toHex(mintSerial(repeat(0x80, 20))), "null")
  t.eqStr("twenty-one octets answer null", toHex(mintSerial(repeat(0x01, 21))), "null")
  const topBit: u8[] | null = mintSerial(fromHex("80"))
  if (topBit !== null) {
    const cert: X509Certificate | null = x509ParseCertificate(topBit)
    t.eqStr("a serial of 0x80 is written as the INTEGER 00 80", cert === null ? "null" : toHex(cert.serial), "0080")
  } else {
    t.fail("a serial of 0x80 is written as the INTEGER 00 80", "the mint answered null")
  }

  t.eqStr("an empty common name answers null", toHex(mintName("")), "null")
  t.ok("a 64-byte common name mints", mintName(letters(64)) !== null)
  t.eqStr("a 65-byte common name answers null", toHex(mintName(letters(65))), "null")

  const noKey: u8[] | null = x509MintSelfSigned(repeat(0, 32), "localhost", NOT_BEFORE, 14, fromHex(SERIAL))
  t.eqStr("private key 0 answers null", toHex(noKey), "null")
  const orderKey: u8[] | null = x509MintSelfSigned(fromHex(N), "localhost", NOT_BEFORE, 14, fromHex(SERIAL))
  t.eqStr("private key n answers null", toHex(orderKey), "null")
  const shortKey: u8[] | null = x509MintSelfSigned(repeat(1, 31), "localhost", NOT_BEFORE, 14, fromHex(SERIAL))
  t.eqStr("a 31-byte private key answers null", toHex(shortKey), "null")
  return t.done()
}

const parseSuite = (): i32 => {
  const t = new Suite("x509 parse")
  const golden: X509Certificate | null = x509ParseCertificate(fromHex(GOLDEN))
  if (golden === null) {
    t.fail("the golden certificate parses", "null")
    return t.done()
  }
  t.pass("the golden certificate parses")
  t.eqStr("its der is the input", toHex(golden.der), GOLDEN)
  t.eqStr("its serial", toHex(golden.serial), SERIAL)
  t.eqStr("its public key is A.2.5's", toHex(golden.publicKey), PUBLIC)
  t.ok("the key is P-256", golden.p256)
  t.ok("the algorithm is ecdsa-with-SHA256", golden.ecdsaSha256)
  t.eqI64("notBefore", golden.notBefore, NOT_BEFORE)
  t.eqI64("notAfter", golden.notAfter, NOT_AFTER)
  t.eqStr("issuer is subject", toHex(golden.issuer), toHex(golden.subject))
  t.eqStr(
    "the subject is CN=localhost",
    toHex(golden.subject),
    "30143112301006035504030c096c6f63616c686f7374"
  )
  t.eqI32("tbs is the second element's 205 bytes", toI32(golden.tbs.length), 205)
  t.ok("it verifies under itself", x509VerifySignature(golden, golden))
  const forged: X509Certificate | null = x509ParseCertificate(flipLast(fromHex(GOLDEN)))
  t.ok("with the last byte of s flipped it parses", forged !== null)
  if (forged !== null) {
    t.eqBool("and does not verify", x509VerifySignature(forged, golden), false)
  }

  t.ok("a truncated DER is refused", refused(fromHex(BAD_TRUNCATED)))
  t.ok("an octet after the certificate is refused", refused(fromHex(BAD_TRAILING)))
  t.ok("a length with a leading zero octet is refused", refused(fromHex(BAD_LONG_LENGTH)))
  t.ok("a long-form length below 128 is refused", refused(fromHex(BAD_SHORT_LONG_FORM)))
  t.ok("an indefinite length is refused", refused(fromHex(BAD_INDEFINITE)))
  t.ok("a high-tag-number identifier is refused", refused(fromHex(BAD_HIGH_TAG)))
  t.ok("a four-octet length past 2^31 - 1 is refused", refused(fromHex(BAD_LENGTH_OVER_I32)))
  t.ok("a serial with a redundant zero octet is refused", refused(fromHex(BAD_SERIAL_PADDED)))
  t.ok("a TBS algorithm unlike the outer one is refused", refused(fromHex(BAD_ALGORITHM_MISMATCH)))
  t.ok("month 13 is refused", refused(fromHex(BAD_MONTH_13)))
  t.ok("an explicit version v1 is refused", refused(fromHex(BAD_VERSION_1)))
  t.ok("a signature with unused bits is refused", refused(fromHex(BAD_UNUSED_BITS)))
  t.ok("extensions in a v1 certificate are refused", refused(fromHex(BAD_EXTENSIONS_IN_V1)))
  t.ok("an empty DER is refused", refused([]))
  t.ok("a truncated DER in PEM is refused by the chain reader", x509ParseChain(hexPem(BAD_TRUNCATED, "CERTIFICATE")) === null)
  return t.done()
}

const pemSuite = (): i32 => {
  const t = new Suite("x509 pem")
  t.eqStr("one byte is AA==", derToPem([0], "X"), "-----BEGIN X-----\nAA==\n-----END X-----\n")
  t.eqStr("two bytes are AAE=", derToPem([0, 1], "X"), "-----BEGIN X-----\nAAE=\n-----END X-----\n")
  t.eqStr("three bytes are AAEC", derToPem([0, 1, 2], "X"), "-----BEGIN X-----\nAAEC\n-----END X-----\n")
  t.eqStr("+ and / are the alphabet's last two", derToPem([0xfb, 0xff], "X"), "-----BEGIN X-----\n+/8=\n-----END X-----\n")
  t.eqStr("AA== reads back", onlyBlock("-----BEGIN X-----\nAA==\n-----END X-----\n", "X"), "00")
  t.eqStr("AAE= reads back", onlyBlock("-----BEGIN X-----\nAAE=\n-----END X-----\n", "X"), "0001")
  t.eqStr("+/8= reads back", onlyBlock("-----BEGIN X-----\n+/8=\n-----END X-----\n", "X"), "fbff")
  t.eqStr("OpenSSL's golden PEM reads back to the golden DER", onlyBlock(GOLDEN_PEM, "CERTIFICATE"), GOLDEN)
  t.eqStr(
    "CRLF line ends are read",
    onlyBlock("-----BEGIN X-----\r\nAAEC\r\n-----END X-----\r\n", "X"),
    "000102"
  )
  t.eqStr(
    "without a final line feed it is read",
    onlyBlock("-----BEGIN X-----\nAAEC\n-----END X-----", "X"),
    "000102"
  )
  t.eqI32(
    "text around blocks and blocks with other labels are skipped",
    blockCount(`notes\n${CA_PKCS8_PEM}between\n${GOLDEN_PEM}${CA_PEM}after\n`, "CERTIFICATE"),
    2
  )

  t.eqI32("a wrong label answers null", blockCount(GOLDEN_PEM, "PRIVATE KEY"), -1)
  t.eqI32("a label matches whole, not as a suffix", blockCount(CA_SEC1_PEM, "PRIVATE KEY"), -1)
  t.eqI32("an END label unlike its BEGIN answers null", blockCount("-----BEGIN X-----\nAAEC\n-----END Y-----\n", "X"), -1)
  t.eqI32("an unterminated block answers null", blockCount("-----BEGIN X-----\nAAEC\n", "X"), -1)
  t.eqI32("an END outside a block answers null", blockCount("-----END X-----\n", "X"), -1)
  t.eqI32(
    "a 65-character line answers null",
    blockCount(`-----BEGIN X-----\n${letters(64)}AAAA\n-----END X-----\n`, "X"),
    -1
  )
  t.eqI32(
    "a short line before the last answers null",
    blockCount("-----BEGIN X-----\nAAEC\nAAEC\n-----END X-----\n", "X"),
    -1
  )
  t.eqI32(
    "an RFC 1421 header answers null",
    blockCount("-----BEGIN X-----\nProc-Type: 4,ENCRYPTED\n\nAAEC\n-----END X-----\n", "X"),
    -1
  )
  t.eqI32("AB==, with a bit set past the byte, answers null", blockCount("-----BEGIN X-----\nAB==\n-----END X-----\n", "X"), -1)
  t.eqI32("a character outside the alphabet answers null", blockCount("-----BEGIN X-----\nAA-C\n-----END X-----\n", "X"), -1)
  t.eqI32("= inside the data answers null", blockCount("-----BEGIN X-----\nA=AA\n-----END X-----\n", "X"), -1)
  t.eqI32("a length not a multiple of four answers null", blockCount("-----BEGIN X-----\nAAE\n-----END X-----\n", "X"), -1)
  t.eqI32("an empty block answers null", blockCount("-----BEGIN X-----\n-----END X-----\n", "X"), -1)
  t.eqI32("no block at all answers null", blockCount("", "X"), -1)
  return t.done()
}

const keySuite = (): i32 => {
  const t = new Suite("x509 keys")
  t.eqStr("OpenSSL's PKCS#8 key", toHex(x509ParseP256PrivateKey(CA_PKCS8_PEM)), CA_PRIVATE)
  t.eqStr("OpenSSL's SEC1 key, the same", toHex(x509ParseP256PrivateKey(CA_SEC1_PEM)), CA_PRIVATE)
  t.eqStr("A.2.5's key as SEC1", toHex(x509ParseP256PrivateKey(hexPem(KEY_SEC1, "EC PRIVATE KEY"))), PRIVATE)
  t.eqStr("A.2.5's key as PKCS#8", toHex(x509ParseP256PrivateKey(hexPem(KEY_PKCS8, "PRIVATE KEY"))), PRIVATE)

  t.eqStr("a P-384 PKCS#8 key answers null", toHex(x509ParseP256PrivateKey(P384_PKCS8_PEM)), "null")
  t.eqStr("a P-384 SEC1 key answers null", toHex(x509ParseP256PrivateKey(P384_SEC1_PEM)), "null")
  t.eqStr(
    "a bare SEC1 key that does not name its curve answers null",
    toHex(x509ParseP256PrivateKey(hexPem(KEY_SEC1_NO_CURVE, "EC PRIVATE KEY"))),
    "null"
  )
  t.eqStr(
    "a SEC1 key whose stored public key is not its own answers null",
    toHex(x509ParseP256PrivateKey(hexPem(KEY_SEC1_WRONG_PUBLIC, "EC PRIVATE KEY"))),
    "null"
  )
  t.eqStr("scalar 0 answers null", toHex(x509ParseP256PrivateKey(hexPem(KEY_SEC1_ZERO, "EC PRIVATE KEY"))), "null")
  t.eqStr("scalar n answers null", toHex(x509ParseP256PrivateKey(hexPem(KEY_SEC1_ORDER, "EC PRIVATE KEY"))), "null")
  t.eqStr(
    "a long-form length below 128 answers null",
    toHex(x509ParseP256PrivateKey(hexPem(KEY_SEC1_SHORT_LONG_FORM, "EC PRIVATE KEY"))),
    "null"
  )
  t.eqStr(
    "SEC1 under the PKCS#8 label answers null",
    toHex(x509ParseP256PrivateKey(hexPem(KEY_SEC1, "PRIVATE KEY"))),
    "null"
  )
  t.eqStr("a certificate is not a key", toHex(x509ParseP256PrivateKey(GOLDEN_PEM)), "null")
  t.eqStr(
    "two keys answer null",
    toHex(x509ParseP256PrivateKey(`${CA_PKCS8_PEM}${hexPem(KEY_PKCS8, "PRIVATE KEY")}`)),
    "null"
  )
  t.eqStr("a key in both forms answers null", toHex(x509ParseP256PrivateKey(`${CA_PKCS8_PEM}${CA_SEC1_PEM}`)), "null")
  return t.done()
}

const chainSuite = (): i32 => {
  const t = new Suite("x509 chain")
  const chain: X509Certificate[] | null = x509ParseChain(`${LEAF_PEM}${CA_PEM}`)
  if (chain === null || toI32(chain.length) !== 2) {
    t.fail("OpenSSL's leaf and CA read as a chain of two", "no")
    return t.done()
  }
  t.pass("OpenSSL's leaf and CA read as a chain of two")
  const leaf: X509Certificate = chain[0]
  const ca: X509Certificate = chain[1]
  t.eqStr("the leaf's hash is OpenSSL's", toHex(x509CertificateHash(leaf.der)), LEAF_SHA256)
  t.eqStr("the CA's hash is OpenSSL's", toHex(x509CertificateHash(ca.der)), CA_SHA256)
  t.eqStr("the leaf's serial is 0x7a", toHex(leaf.serial), "7a")
  t.eqI64("the leaf's notBefore", leaf.notBefore, LEAF_NOT_BEFORE)
  t.eqI64("the leaf's notAfter", leaf.notAfter, LEAF_NOT_AFTER)
  t.eqI64("the CA's notBefore", ca.notBefore, CA_NOT_BEFORE)
  t.eqI64("the CA's notAfter", ca.notAfter, CA_NOT_AFTER)
  t.ok("both keys are P-256", leaf.p256 && ca.p256)
  t.eqStr("the leaf's issuer is the CA's subject", toHex(leaf.issuer), toHex(ca.subject))
  t.ok("the leaf verifies under the CA", x509VerifySignature(leaf, ca))
  t.ok("the CA, with extensions, verifies under itself", x509VerifySignature(ca, ca))
  t.eqBool("the leaf does not verify under itself", x509VerifySignature(leaf, leaf), false)
  const priv: u8[] | null = x509ParseP256PrivateKey(CA_PKCS8_PEM)
  t.eqStr(
    "the CA's parsed private key gives its certificate's public key",
    priv === null ? "null" : toHex(p256PublicKey(priv)),
    toHex(ca.publicKey)
  )
  if (priv !== null) {
    const minted: u8[] | null = x509MintSelfSigned(priv, "nish", CA_NOT_BEFORE, 7, fromHex("01"))
    const cert: X509Certificate | null = minted === null ? null : x509ParseCertificate(minted)
    t.ok("a certificate minted with OpenSSL's key verifies under itself", cert !== null && x509VerifySignature(cert, cert))
  }

  t.ok(
    "a chain with one bad certificate answers null",
    x509ParseChain(`${LEAF_PEM}${hexPem(BAD_MONTH_13, "CERTIFICATE")}`) === null
  )
  t.ok("a PEM with no certificate answers null", x509ParseChain(CA_PKCS8_PEM) === null)
  return t.done()
}

export const main = (): i32 => mintSuite() + parseSuite() + pemSuite() + keySuite() + chainSuite()

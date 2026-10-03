// `nish/crypto/x509` in a program compiled with `--number-mode f64`, where
// every bare `number` and every unannotated literal is an `f64`. The module
// spells its widths, so its answers must not move: the golden certificate
// minted byte for byte, its hash, its times read back and its signature
// verified, days 15 refused, OpenSSL's PKCS#8 key parsed, and the PEM codec's
// round trip. `crypto_x509` has the rest, and the fixtures and hex helper both
// programs share.
import { Suite } from "nish/testing"
import {
  X509Certificate,
  derToPem,
  pemToDer,
  x509CertificateHash,
  x509ParseCertificate,
  x509ParseChain,
  x509VerifySignature,
} from "nish/crypto/x509"
import { x509MintSelfSignedPlain as x509MintSelfSigned, x509ParseP256PrivateKeyPlain as x509ParseP256PrivateKey } from "../crypto_x509/plain"
import { CA_PEM, CA_PKCS8_PEM, CA_PRIVATE, GOLDEN_PEM } from "../crypto_x509/fixtures"
import { fromHex, toHex } from "../crypto_x509/hex"

const GOLDEN: string =
  "308201223081caa00302010202100123456789abcdef0123456789abcdef300a06082a8648ce3d04030230143112301006035504030c096c6f63616c686f7374301e170d3236303130313030303030305a170d3236303131353030303030305a30143112301006035504030c096c6f63616c686f73743059301306072a8648ce3d020106082a8648ce3d0301070342000460fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299300a06082a8648ce3d0403020347003044022041e3cdab220d60d16846a1033a3679f7b0fe54fc74492d8ba72f70817578970302206e840bdbd9eac275a7ca1ca3b39ca8a23e20a06e2d83a076f797bf5a10226506"
// 2026-01-01T00:00:00Z, and fourteen days later.
const NOT_BEFORE: i64 = 1767225600000
const NOT_AFTER: i64 = 1768435200000

/** Mint with RFC 6979 A.2.5's key as localhost at NOT_BEFORE for `days`. */
const mint = (days: i32): u8[] | null =>
  x509MintSelfSigned(
    fromHex("c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721"),
    "localhost",
    NOT_BEFORE,
    days,
    fromHex("0123456789abcdef0123456789abcdef")
  )

export const main = (): i32 => {
  const t = new Suite("x509 (f64 mode)")
  t.eqStr("the golden DER", toHex(mint(14)), GOLDEN)
  t.eqStr(
    "its SHA-256",
    toHex(x509CertificateHash(fromHex(GOLDEN))),
    "1fbbe71684cc9e604673b2e291046ab6ea08aee7db4f9859e87cce9418978b82"
  )
  t.eqStr("days 15 answers null", toHex(mint(15)), "null")
  const cert: X509Certificate | null = x509ParseCertificate(fromHex(GOLDEN))
  if (cert !== null) {
    t.eqI64("notBefore", cert.notBefore, NOT_BEFORE)
    t.eqI64("notAfter", cert.notAfter, NOT_AFTER)
    t.ok("it verifies under itself", x509VerifySignature(cert, cert))
  } else {
    t.fail("the golden certificate parses", "null")
  }
  t.eqStr("its PEM is OpenSSL's", derToPem(fromHex(GOLDEN), "CERTIFICATE"), GOLDEN_PEM)
  const blocks: u8[][] | null = pemToDer(GOLDEN_PEM, "CERTIFICATE")
  t.eqStr("and reads back", blocks === null ? "null" : toHex(blocks[0]), GOLDEN)
  t.eqStr("OpenSSL's PKCS#8 key", toHex(x509ParseP256PrivateKey(CA_PKCS8_PEM)), CA_PRIVATE)
  const chain: X509Certificate[] | null = x509ParseChain(CA_PEM)
  t.ok("OpenSSL's CA verifies under itself", chain !== null && x509VerifySignature(chain[0], chain[0]))
  return t.done()
}

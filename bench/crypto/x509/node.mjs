// The x509 family's Node twin: node:crypto's X509Certificate, under the
// contract in bench/crypto/README.md and the inputs in this family's README.md.
// Node can parse a certificate but has no API that writes one, so it has no
// x509-mint column.
import { X509Certificate } from "node:crypto"

import { FOLD_START, fold, now, parseArgs, report } from "../lib/gen.mjs"

/**
 * The certificate x509-parse reads: Nish's x509-mint output for its first
 * iteration, so every twin parses the same bytes.
 */
const FIXED_CERT = Buffer.from(
  "3082014e3081f6a003020102021057a8a60ac6cf332f0d105dba046fb40d300a06082a8648ce3d04030230193117301506035504030c0e62656e63682e6e6973682e646576301e170d3236303130313030303030305a170d3236303131353030303030305a30193117301506035504030c0e62656e63682e6e6973682e6465763059301306072a8648ce3d020106082a8648ce3d030107034200046773f52bac85b0278dbc1c6ab010e6a63ab5cb19673672f3a66e3b53e5fc31fa6881cfb754e458be32e5c105f96ac0dc83f02224f7c4f0f56ec4f165496b0e53a320301e300c0603551d130101ff04023000300e0603551d0f0101ff040403020780300a06082a8648ce3d04030203470030440220706060f8d5a0c763dafd8f5a9a7cfd6131b7eba82739420235dcd9f91b2371f102207d9f5543446e841cc9029d83741fd9ed9753120cd1eefa51f098e6f60dc74742",
  "hex"
)

const a = parseArgs("node.mjs")
if (a.kernel !== "x509-parse") {
  console.error(`node.mjs: no kernel ${a.kernel}`)
  process.exit(2)
}
if (a.size !== FIXED_CERT.length) {
  console.error(`node.mjs: x509-parse's size is ${FIXED_CERT.length}, the fixed certificate's length`)
  process.exit(2)
}

/** Seconds since 1970 from one of X509Certificate's dates, as eight big-endian bytes. */
const seconds = (date) => {
  const out = Buffer.alloc(8)
  out.writeBigUInt64BE(BigInt(Date.parse(date) / 1000))
  return out
}

let sum = FOLD_START
const started = now()
for (let i = 0; i < a.iterations; i++) {
  const cert = new X509Certificate(FIXED_CERT)
  const cn = /^CN=(.*)$/m.exec(cert.subject)
  const spki = cert.publicKey.export({ format: "der", type: "spki" })
  if (cn === null) {
    console.error("node.mjs: the fixed certificate has no common name")
    process.exit(1)
  }
  sum = fold(fold(fold(sum, Buffer.from(cn[1])), seconds(cert.validFrom)), seconds(cert.validTo))
  // The point is the SPKI's last 65 bytes; verify checks the signature alone.
  sum = fold(fold(sum, spki.subarray(spki.length - 65)), [cert.verify(cert.publicKey) ? 1 : 0])
}
report(sum, started)

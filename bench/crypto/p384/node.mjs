// The p384 family's Node twin: node:crypto's verify with SHA-384 and IEEE
// P1363 signatures, under the contract in bench/crypto/README.md and the inputs
// in this family's README.md. Node signs its own ring before the clock starts.
import { createPublicKey, sign, verify } from "node:crypto"

import { FOLD_START, fold, now, parseArgs, report } from "../lib/gen.mjs"
import { RING, TAMPERED, ring } from "./key.mjs"

const a = parseArgs("node.mjs")
if (a.kernel !== "p384-verify") {
  console.error(`node.mjs: no kernel ${a.kernel}`)
  process.exit(2)
}
if (a.size < 4) {
  console.error("node.mjs: the size is at least 4 bytes")
  process.exit(2)
}
const { key, pub, msgs } = ring(a.size)
const publicKey = createPublicKey(key)
const sigs = msgs.map((m) => sign("sha384", m, { key, dsaEncoding: "ieee-p1363" }))
msgs[TAMPERED][a.size - 1] ^= 1
let sum = fold(FOLD_START, pub)
const started = now()
for (let i = 0; i < a.iterations; i++) {
  const j = i % RING
  const ok = verify("sha384", msgs[j], { key: publicKey, dsaEncoding: "ieee-p1363" }, sigs[j])
  if (ok !== (j !== TAMPERED)) {
    console.error("node.mjs: p384-verify gave the wrong answer")
    process.exit(1)
  }
  sum = fold(sum, [ok ? 1 : 0])
}
report(sum, started)

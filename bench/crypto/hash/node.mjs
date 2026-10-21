// The hash family's Node twin: node:crypto's createHash, createHmac and
// hkdfSync, under the contract in bench/crypto/README.md and the inputs in
// this family's README.md.
import { createHash, createHmac, hkdfSync } from "node:crypto"

import { FOLD_START, fold, inputs, now, parseArgs, report, tweak } from "../lib/gen.mjs"

const a = parseArgs("node.mjs")
const shape = {
  sha256: [0, 0],
  sha512: [0, 0],
  "hmac-sha256": [32, 0],
  "hkdf-sha256": [32, 10],
}[a.kernel]
if (shape === undefined) {
  console.error(`node.mjs: no kernel ${a.kernel}`)
  process.exit(2)
}
const inp = inputs(a.kernel, a.size, shape[0], 0, shape[1], a.size)
const msg = inp.msg
const base = Buffer.from(msg.subarray(0, 4))
const once = {
  sha256: () => createHash("sha256").update(msg).digest(),
  sha512: () => createHash("sha512").update(msg).digest(),
  "hmac-sha256": () => createHmac("sha256", inp.key).update(msg).digest(),
  "hkdf-sha256": () => new Uint8Array(hkdfSync("sha256", msg, inp.key, inp.aad, 42)),
}[a.kernel]
let sum = FOLD_START
const started = now()
for (let i = 0; i < a.iterations; i++) {
  tweak(msg, 0, base, i)
  sum = fold(sum, once())
}
report(sum, started)

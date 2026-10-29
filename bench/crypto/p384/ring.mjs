// Prints the ring main.ts embeds: nish/crypto/p384 verifies but cannot sign,
// so its signatures are made here, once, by node:crypto. Run it and paste its
// output over main.ts's PUB and RING_SIGS when the input stream or the size changes.
//
//   node bench/crypto/p384/ring.mjs [size]
import { sign } from "node:crypto"

import { RING, ring } from "./key.mjs"

const size = Number(process.argv[2] ?? 64)
const { key, pub, msgs } = ring(size)
const sigs = []
for (let j = 0; j < RING; j++) {
  sigs.push(sign("sha384", msgs[j], { key, dsaEncoding: "ieee-p1363" }).toString("hex"))
}
console.log(
  `/** The public key of the input stream's scalar, uncompressed: nish/crypto/p384 cannot derive it. */`
)
console.log(`const PUB: string = "${pub.toString("hex")}"\n`)
console.log(
  `/** Each ring entry's 96-byte signature, r || s, in turn: made by ring.mjs for ${size}-byte messages. */`
)
console.log(`const RING_SIGS: string =\n  "${sigs.join("")}"`)

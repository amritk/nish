// The p384 family's signing key and ring, shared by node.mjs and ring.mjs: the
// fixed P-384 key from the input stream, and the messages the verify kernel
// cycles through.
import { createPrivateKey, createPublicKey } from "node:crypto"

import { inputs, tweak } from "../lib/gen.mjs"

/** Messages the verify kernel cycles through, signed before the clock starts. */
export const RING = 16

/** The ring entry changed after it was signed, so its verify must answer false. */
export const TAMPERED = 1

/** The SEC1 ECPrivateKey around a P-384 scalar: the bytes before it and after it. */
const P384_SEC1 = [Buffer.from("303e0201010430", "hex"), Buffer.from("a00706052b81040022", "hex")]

/** The key from the input stream and the ring's messages, untampered, for `size`-byte messages. */
export const ring = (size) => {
  const inp = inputs("p384-verify", size, 48, 0, 0, size)
  const key = createPrivateKey({
    key: Buffer.concat([P384_SEC1[0], inp.key, P384_SEC1[1]]),
    format: "der",
    type: "sec1",
  })
  const spki = createPublicKey(key).export({ format: "der", type: "spki" })
  const base = Buffer.from(inp.msg.subarray(0, 4))
  const msgs = []
  for (let j = 0; j < RING; j++) {
    const m = Buffer.from(inp.msg)
    tweak(m, 0, base, j)
    msgs.push(m)
  }
  return { key, pub: spki.subarray(spki.length - 97), msgs }
}

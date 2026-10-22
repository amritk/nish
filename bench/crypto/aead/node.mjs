// The AEAD family's Node twin: node:crypto's createCipheriv and
// createDecipheriv, under the contract in bench/crypto/README.md and the
// inputs in this family's README.md. Node keys a cipher per message: it has no
// object that holds an expanded key across nonces, so every iteration pays the
// key schedule the other twins pay once.
import { createCipheriv, createDecipheriv } from "node:crypto"

import { FOLD_START, fold, inputs, now, parseArgs, report, tweak } from "../lib/gen.mjs"

const NONCE = 12
const NONCE_TWEAK = 8
const AAD = 13
const RING = 16
const TAG = 16

const a = parseArgs("node.mjs")
const [, cipherName, op] = /^(aes128gcm|aes256gcm|chacha20poly1305)-(seal|open)$/.exec(a.kernel) ?? []
if (cipherName === undefined) {
  console.error(`node.mjs: no kernel ${a.kernel}`)
  process.exit(2)
}
if (a.size < 4) {
  console.error("node.mjs: the size is at least 4 bytes")
  process.exit(2)
}
const [algorithm, keyLen] = {
  aes128gcm: ["aes-128-gcm", 16],
  aes256gcm: ["aes-256-gcm", 32],
  chacha20poly1305: ["chacha20-poly1305", 32],
}[cipherName]
const inp = inputs(a.kernel, a.size, keyLen, NONCE, AAD, a.size)
const { key, nonce, aad, msg } = inp
const msgBase = Buffer.from(msg.subarray(0, 4))
const nonceBase = Buffer.from(nonce.subarray(NONCE_TWEAK, NONCE_TWEAK + 4))
const out = Buffer.alloc(a.size + TAG)

/** Seal `msg` under `nonce` into `out`: the ciphertext, then the tag. */
const seal = () => {
  const c = createCipheriv(algorithm, key, nonce, { authTagLength: TAG })
  c.setAAD(aad)
  const n = c.update(msg).copy(out, 0)
  c.final()
  c.getAuthTag().copy(out, n)
  return out
}

let sum = FOLD_START
if (op === "seal") {
  const started = now()
  for (let i = 0; i < a.iterations; i++) {
    tweak(msg, 0, msgBase, i)
    tweak(nonce, NONCE_TWEAK, nonceBase, i)
    sum = fold(sum, seal())
  }
  report(sum, started)
} else {
  // The ring: entry r is the seal of the message and nonce tweaked with r.
  const ring = []
  for (let r = 0; r < RING; r++) {
    tweak(msg, 0, msgBase, r)
    tweak(nonce, NONCE_TWEAK, nonceBase, r)
    ring.push(Buffer.from(seal()))
  }
  const started = now()
  for (let i = 0; i < a.iterations; i++) {
    const r = i % RING
    tweak(nonce, NONCE_TWEAK, nonceBase, r)
    const sealed = ring[r]
    const d = createDecipheriv(algorithm, key, nonce, { authTagLength: TAG })
    d.setAAD(aad)
    d.setAuthTag(sealed.subarray(a.size))
    const opened = d.update(sealed.subarray(0, a.size))
    try {
      d.final()
    } catch {
      console.error("node.mjs: open failed")
      process.exit(1)
    }
    sum = fold(sum, opened)
  }
  report(sum, started)
}

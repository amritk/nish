// The curves family's Node twin: node:crypto's createPrivateKey, sign, verify
// and diffieHellman, under the contract in bench/crypto/README.md and the
// inputs in this family's README.md. Raw keys go in as the DER that wraps
// them, the only way node:crypto takes them.
import { createHash, createPrivateKey, createPublicKey, diffieHellman, sign, verify } from "node:crypto"

import { FOLD_START, fold, inputs, now, parseArgs, report, tweak } from "../lib/gen.mjs"

/** Messages the verify kernels cycle through, signed before the clock starts. */
const RING = 16

/** The ring entry changed after it was signed, so its verify must answer false. */
const TAMPERED = 1

const X25519_PKCS8 = Buffer.from("302e020100300506032b656e04220420", "hex")
const X25519_SPKI = Buffer.from("302a300506032b656e032100", "hex")
const ED25519_PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex")
const P256_SEC1 = [Buffer.from("30310201010420", "hex"), Buffer.from("a00a06082a8648ce3d030107", "hex")]

const a = parseArgs("node.mjs")
const kernels = ["x25519-base", "x25519", "p256-sign", "p256-verify", "ed25519-sign", "ed25519-verify"]
if (!kernels.includes(a.kernel)) {
  console.error(`node.mjs: no kernel ${a.kernel}`)
  process.exit(2)
}
const curve25519 = a.kernel.startsWith("x25519")
if (curve25519 ? a.size !== 32 : a.size < 4) {
  console.error(`node.mjs: ${curve25519 ? "an X25519 kernel's size is 32" : "the size is at least 4 bytes"}`)
  process.exit(2)
}
const inp = inputs(a.kernel, a.size, a.kernel === "x25519-base" ? 0 : 32, 0, 0, a.size)
const msg = inp.msg
const base = Buffer.from(msg.subarray(0, 4))
let sum = FOLD_START

/** The raw public key: the bytes after the SPKI's fixed prefix. */
const rawPublic = (privateKey, length) => {
  const spki = createPublicKey(privateKey).export({ format: "der", type: "spki" })
  return spki.subarray(spki.length - length)
}

const x25519Key = (scalar) =>
  createPrivateKey({ key: Buffer.concat([X25519_PKCS8, scalar]), format: "der", type: "pkcs8" })

const ec = a.kernel.startsWith("p256-")
/** The fixed signing key: P-256 from a SEC1 ECPrivateKey, Ed25519 from PKCS #8; none for X25519. */
const signingKey = () => {
  if (curve25519) {
    return null
  }
  if (ec) {
    return createPrivateKey({
      key: Buffer.concat([P256_SEC1[0], inp.key, P256_SEC1[1]]),
      format: "der",
      type: "sec1",
    })
  }
  return createPrivateKey({ key: Buffer.concat([ED25519_PKCS8, inp.key]), format: "der", type: "pkcs8" })
}
const key = signingKey()
const pub = key === null ? null : createPublicKey(key)
// ECDSA hashes with SHA-256; Ed25519 takes the message whole.
const hash = ec ? "sha256" : null

if (a.kernel === "x25519-base") {
  const started = now()
  for (let i = 0; i < a.iterations; i++) {
    tweak(msg, 0, base, i)
    sum = fold(sum, rawPublic(x25519Key(msg), 32))
  }
  report(sum, started)
} else if (a.kernel === "x25519") {
  const privateKey = x25519Key(inp.key)
  let u = msg
  const started = now()
  for (let i = 0; i < a.iterations; i++) {
    const publicKey = createPublicKey({ key: Buffer.concat([X25519_SPKI, u]), format: "der", type: "spki" })
    u = diffieHellman({ privateKey, publicKey })
    sum = fold(sum, u)
  }
  report(sum, started)
} else if (a.kernel.endsWith("-sign")) {
  sum = fold(sum, rawPublic(key, ec ? 65 : 32))
  const msgs = []
  const sigs = []
  let started = now()
  for (let i = 0; i < a.iterations; i++) {
    tweak(msg, 0, base, i)
    const sig = sign(hash, msg, key)
    if (ec) {
      msgs.push(Buffer.from(msg))
      sigs.push(sig)
    } else {
      sum = fold(sum, sig)
    }
  }
  if (ec) {
    // ECDSA's signatures are randomised, so what is folded is each digest
    // and whether its signature verifies, checked after the clock stops.
    const stopped = now()
    for (let i = 0; i < msgs.length; i++) {
      const digest = createHash("sha256").update(msgs[i]).digest()
      sum = fold(fold(sum, digest), [verify(hash, msgs[i], pub, sigs[i]) ? 1 : 0])
    }
    started += now() - stopped
  }
  report(sum, started)
} else {
  sum = fold(sum, rawPublic(key, ec ? 65 : 32))
  const msgs = []
  const sigs = []
  for (let j = 0; j < RING; j++) {
    const m = Buffer.from(msg)
    tweak(m, 0, base, j)
    msgs.push(m)
    sigs.push(sign(hash, m, key))
  }
  msgs[TAMPERED][a.size - 1] ^= 1
  const started = now()
  for (let i = 0; i < a.iterations; i++) {
    const j = i % RING
    const ok = verify(hash, msgs[j], pub, sigs[j])
    if (ok !== (j !== TAMPERED)) {
      console.error(`node.mjs: ${a.kernel} gave the wrong answer`)
      process.exit(1)
    }
    sum = fold(sum, [ok ? 1 : 0])
  }
  report(sum, started)
}

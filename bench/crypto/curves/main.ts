// The curves family's Nish program: X25519 and ECDSA over P-256 from
// std/crypto, under the contract in bench/crypto/README.md. bench/crypto/run.mjs
// builds it with `--profile speed` and runs
//
//   main <kernel> <size> <iterations>
//
// The inputs each kernel draws, and what each folds, are in this family's
// README.md. The two Ed25519 kernels have no Nish column: std/crypto has no
// Ed25519.
import { p256PublicKey, p256Sign, p256Verify, p256VerifySha256, p256SignSha256 } from "nish/crypto/p256"
import { sha256 } from "nish/crypto/sha256"
import { x25519, x25519Base } from "nish/crypto/x25519"
import { Secret, expose, secret, wipe } from "nish:secret"
import { Args, baseOf, fold, foldStart, Inputs, inputs, now, parseArgs, report, tweak } from "../lib/gen"

/** Messages the verify kernel cycles through, signed before the clock starts. */
const RING: i32 = 16

/** The ring entry whose message is changed after it was signed, so its verify must answer false. */
const TAMPERED: i32 = 1

/** A fresh copy of `bytes`: what `secret` takes, and what leaves an `expose`. */
const copyOf = (bytes: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(bytes.length)
  for (let i: i32 = 0; i < toI32(bytes.length); i++) {
    if (i < toI32(out.length)) {
      out[i] = bytes[i]
    }
  }
  return out
}

/** X25519 of the tweaked scalar and the base point. */
const baseLoop = (a: Args): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 0, 0, 0, a.size)
  const msg: u8[] = inp.msg
  const base: u8[] = baseOf(msg, 0)
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    tweak(msg, 0, base, i)
    const scalar: Secret<u8[]> = secret(copyOf(msg))
    const pub: u8[] | null = x25519Base(scalar)
    wipe(scalar)
    if (pub === null) {
      writeError("curves: x25519Base answered null\n")
      return 1
    }
    sum = fold(sum, pub)
  }
  report(sum, started)
  return 0
}

/** X25519 of the fixed scalar and the previous iteration's answer. */
const ladderLoop = (a: Args): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 32, 0, 0, a.size)
  const scalar: Secret<u8[]> = secret(copyOf(inp.key))
  const u: u8[] = inp.msg
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    const shared: Secret<u8[]> | null = x25519(scalar, u)
    if (shared === null) {
      writeError("curves: x25519 answered null\n")
      wipe(scalar)
      return 1
    }
    const next: u8[] = expose(shared, copyOf)
    wipe(shared)
    for (let k: i32 = 0; k < toI32(next.length); k++) {
      if (k < toI32(u.length)) {
        u[k] = next[k]
      }
    }
    sum = fold(sum, u)
  }
  report(sum, started)
  wipe(scalar)
  return 0
}

/**
 * ECDSA P-256 over SHA-256 of the tweaked message. Go's and OpenSSL's
 * signatures are randomised, so the fold is each digest and whether its
 * signature verifies, checked after the clock stops and not timed.
 */
const signLoop = (a: Args): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 32, 0, 0, a.size)
  const priv: Secret<u8[]> = secret(copyOf(inp.key))
  const pub: u8[] | null = p256PublicKey(priv)
  if (pub === null) {
    writeError("curves: p256PublicKey answered null\n")
    wipe(priv)
    return 1
  }
  const msg: u8[] = inp.msg
  const base: u8[] = baseOf(msg, 0)
  const digests: u8[][] = []
  const sigs: u8[][] = []
  // The byte folded for each verify: 1 when it answered true, 0 when false.
  const valid: u8[] = [toU8(1)]
  const invalid: u8[] = [toU8(0)]
  let sum: u32 = fold(foldStart(), pub)
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    tweak(msg, 0, base, i)
    const digest: u8[] = sha256(msg)
    const sig: u8[] | null = p256Sign(priv, digest)
    if (sig === null) {
      writeError("curves: p256Sign answered null\n")
      wipe(priv)
      return 1
    }
    digests.push(digest)
    sigs.push(sig)
  }
  const stopped: i64 = now()
  wipe(priv)
  for (let i: i32 = 0; i < toI32(digests.length); i++) {
    if (i < toI32(sigs.length)) {
      sum = fold(fold(sum, digests[i]), p256Verify(pub, digests[i], sigs[i]) ? valid : invalid)
    }
  }
  report(sum, started + (now() - stopped))
  return 0
}

/** ECDSA P-256 verify, SHA-256 included, over a ring of signed messages, one of them tampered with. */
const verifyLoop = (a: Args): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 32, 0, 0, a.size)
  const priv: Secret<u8[]> = secret(copyOf(inp.key))
  const pub: u8[] | null = p256PublicKey(priv)
  if (pub === null) {
    writeError("curves: p256PublicKey answered null\n")
    wipe(priv)
    return 1
  }
  const base: u8[] = baseOf(inp.msg, 0)
  const msgs: u8[][] = []
  const sigs: u8[][] = []
  for (let j: i32 = 0; j < RING; j++) {
    const m: u8[] = copyOf(inp.msg)
    tweak(m, 0, base, j)
    const sig: u8[] | null = p256SignSha256(priv, m)
    if (sig === null) {
      writeError("curves: p256SignSha256 answered null\n")
      wipe(priv)
      return 1
    }
    msgs.push(m)
    sigs.push(sig)
  }
  wipe(priv)
  const last: i32 = a.size - 1
  msgs[TAMPERED][last] = msgs[TAMPERED][last] ^ toU8(1)
  // The byte folded for each verify: 1 when it answered true, 0 when false.
  const valid: u8[] = [toU8(1)]
  const invalid: u8[] = [toU8(0)]
  let sum: u32 = fold(foldStart(), pub)
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    const j: i32 = i % RING
    if (j < 0 || j >= toI32(msgs.length) || j >= toI32(sigs.length)) {
      return 1
    }
    const ok: boolean = p256VerifySha256(pub, msgs[j], sigs[j])
    if (ok !== (j !== TAMPERED)) {
      writeError("curves: p256VerifySha256 gave the wrong answer\n")
      return 1
    }
    sum = fold(sum, ok ? valid : invalid)
  }
  report(sum, started)
  return 0
}

export const main = (): i32 => {
  const a: Args | null = parseArgs("curves")
  if (a === null) {
    return 2
  }
  const curve25519: boolean = a.kernel === "x25519-base" || a.kernel === "x25519"
  if (curve25519 ? a.size !== 32 : a.size < 4) {
    writeError(
      curve25519 ? "curves: an X25519 kernel's size is 32\n" : "curves: the size is at least 4 bytes\n"
    )
    return 2
  }
  if (a.kernel === "x25519-base") {
    return baseLoop(a)
  }
  if (a.kernel === "x25519") {
    return ladderLoop(a)
  }
  if (a.kernel === "p256-sign") {
    return signLoop(a)
  }
  if (a.kernel === "p256-verify") {
    return verifyLoop(a)
  }
  writeError(`curves: no kernel ${a.kernel}\n`)
  return 2
}

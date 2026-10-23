// The AEAD family's Nish program: AES-128-GCM, AES-256-GCM and
// ChaCha20-Poly1305 from std/crypto, sealing and opening, under the contract
// in bench/crypto/README.md. bench/crypto/run.mjs builds it with
// `--profile speed` and runs
//
//   main <kernel> <size> <iterations>
//
// The inputs each kernel draws are in this family's README.md.
import { aesGcmOpen, aesGcmSeal, AesKey, aesKey } from "nish/crypto/aes"
import { chacha20Poly1305Open, chacha20Poly1305Seal } from "nish/crypto/chacha20poly1305"
import { Args, baseOf, fold, foldStart, Inputs, inputs, now, parseArgs, report, tweak } from "../lib/gen"

/** The nonce's length, and where in it the iteration is XORed: its last four bytes. */
const NONCE: i32 = 12
const NONCE_TWEAK: i32 = 8
/** The AAD's length: a TLS 1.2 record header's. */
const AAD: i32 = 13
/** The sealed messages an open kernel cycles through, sealed before the clock starts. */
const RING: i32 = 16

/** One kernel: which AEAD, its key length, and whether it opens rather than seals. */
class Kernel {
  aes: boolean = true
  keyLen: i32 = 0
  open: boolean = false
}

/** The kernel `name` names, or null. */
const kernelOf = (name: string): Kernel | null => {
  const k = new Kernel()
  let cipher: string = name
  if (name.endsWith("-seal")) {
    cipher = name.slice(0, name.length - 5)
  } else if (name.endsWith("-open")) {
    cipher = name.slice(0, name.length - 5)
    k.open = true
  } else {
    return null
  }
  if (cipher === "aes128gcm") {
    k.keyLen = 16
  } else if (cipher === "aes256gcm") {
    k.keyLen = 32
  } else if (cipher === "chacha20poly1305") {
    k.aes = false
    k.keyLen = 32
  } else {
    return null
  }
  return k
}

/** Seal under the AEAD `k` names: the AES key for AES-GCM, the raw key for ChaCha20-Poly1305. */
const seal = (k: Kernel, aes: AesKey, key: u8[], nonce: u8[], aad: u8[], msg: u8[]): u8[] | null =>
  k.aes ? aesGcmSeal(aes, nonce, aad, msg) : chacha20Poly1305Seal(key, nonce, aad, msg)

/** Open under the AEAD `k` names. */
const open = (k: Kernel, aes: AesKey, key: u8[], nonce: u8[], aad: u8[], sealed: u8[]): u8[] | null =>
  k.aes ? aesGcmOpen(aes, nonce, aad, sealed) : chacha20Poly1305Open(key, nonce, aad, sealed)

const fail = (what: string): i32 => {
  writeError(`aead: ${what} answered null\n`)
  return 1
}

/** Seal: iteration `i` XORs `i` into the message's first four bytes and the nonce's last four. */
const sealLoop = (a: Args, k: Kernel, inp: Inputs, aes: AesKey): i32 => {
  const msg: u8[] = inp.msg
  const nonce: u8[] = inp.nonce
  const msgBase: u8[] = baseOf(msg, 0)
  const nonceBase: u8[] = baseOf(nonce, NONCE_TWEAK)
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    tweak(msg, 0, msgBase, i)
    tweak(nonce, NONCE_TWEAK, nonceBase, i)
    const sealed: u8[] | null = seal(k, aes, inp.key, nonce, inp.aad, msg)
    if (sealed === null) {
      return fail("seal")
    }
    sum = fold(sum, sealed)
  }
  report(sum, started)
  return 0
}

/**
 * Open: ring entry `r` is the seal of the message and nonce tweaked with `r`,
 * made before the clock starts. Iteration `i` opens entry `i % RING` under
 * that entry's nonce and folds the recovered message.
 */
const openLoop = (a: Args, k: Kernel, inp: Inputs, aes: AesKey): i32 => {
  const msg: u8[] = inp.msg
  const nonce: u8[] = inp.nonce
  const msgBase: u8[] = baseOf(msg, 0)
  const nonceBase: u8[] = baseOf(nonce, NONCE_TWEAK)
  const ring: u8[][] = []
  for (let r: i32 = 0; r < RING; r++) {
    tweak(msg, 0, msgBase, r)
    tweak(nonce, NONCE_TWEAK, nonceBase, r)
    const sealed: u8[] | null = seal(k, aes, inp.key, nonce, inp.aad, msg)
    if (sealed === null) {
      return fail("seal")
    }
    ring.push(sealed)
  }
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    const r: i32 = i % RING
    // Always false, since the ring holds `RING` messages: the proof the
    // index needs, so the access below keeps no bounds check.
    if (r < 0 || r >= toI32(ring.length)) {
      return fail("the ring")
    }
    tweak(nonce, NONCE_TWEAK, nonceBase, r)
    const opened: u8[] | null = open(k, aes, inp.key, nonce, inp.aad, ring[r])
    if (opened === null) {
      return fail("open")
    }
    sum = fold(sum, opened)
  }
  report(sum, started)
  return 0
}

export const main = (): i32 => {
  const a: Args | null = parseArgs("aead")
  if (a === null) {
    return 2
  }
  const k: Kernel | null = kernelOf(a.kernel)
  if (k === null) {
    writeError(`aead: no kernel ${a.kernel}\n`)
    return 2
  }
  if (a.size < 4) {
    writeError("aead: the size is at least 4 bytes\n")
    return 2
  }
  const inp: Inputs = inputs(a.kernel, a.size, k.keyLen, NONCE, AAD, a.size)
  // Expanded once, before the clock. ChaCha20-Poly1305 takes its key raw and
  // never reads this one: its 32 bytes make a valid AES-256 key all the same.
  const aes: AesKey | null = aesKey(inp.key)
  if (aes === null) {
    return fail("aesKey")
  }
  return k.open ? openLoop(a, k, inp, aes) : sealLoop(a, k, inp, aes)
}

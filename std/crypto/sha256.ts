/**
 * `nish/crypto/sha256` — SHA-256 as FIPS 180-4 §6.2 defines it, in pure Nish.
 *
 * Two shapes, because they answer two different callers. `sha256(data)` is the
 * one-shot form for a message that is already in one buffer. `Sha256` is the
 * streaming form, and it exists for TLS 1.3: a handshake hashes its transcript
 * as the messages arrive and needs the hash of the transcript *so far* at
 * several points, which is what `copy()` is for — take a copy, digest the copy,
 * and keep feeding the original.
 *
 *     import { sha256, Sha256 } from "nish/crypto/sha256";
 *
 *     const whole: u8[] = sha256(message);
 *
 *     const h = new Sha256();
 *     h.update(first, 0, toI32(first.length));
 *     const soFar: u8[] = h.copy().digest();
 *     h.update(second, 0, toI32(second.length));
 *     const all: u8[] = h.digest();
 *
 * Input is a window `(buf, off, len)` over a `u8[]`, so a caller hashing one
 * record out of a larger receive buffer does not copy it out first. A digest is
 * always a fresh 32-byte `u8[]`.
 *
 * Every word is a `u32`, whose arithmetic is defined to wrap, so the additions
 * modulo 2^32 that the specification asks for are plain `+` with no masking.
 * Nothing here branches or indexes on the message: the only branches are on
 * lengths and loop counters, which a hash does not keep secret.
 *
 * Written from the specification, not ported from another implementation.
 */

/** The length of a digest in bytes (FIPS 180-4 §1, "Message Digest Size"). */
export const SHA256_SIZE: i32 = 32

/** The length of a message block in bytes (FIPS 180-4 §1, "Block Size"). */
export const SHA256_BLOCK: i32 = 64

/**
 * The round constant K_t of FIPS 180-4 §4.2.2: the first 32 bits of the
 * fractional parts of the cube roots of the first sixty-four primes.
 *
 * A function over a `switch` rather than a table, because a module constant
 * cannot be an array ([LANGUAGE.md](../../docs/LANGUAGE.md#module-constants))
 * and building one per hasher would be sixty-four stores for every `new`. LLVM's
 * code generator turns a `switch` whose every arm returns a constant into a
 * read-only lookup table, so in the binary this is one load. `t` is the round
 * number, never message data.
 */
const sha256RoundConstant = (t: i32): u32 => {
  switch (t) {
    case 0:
      return 0x428a2f98
    case 1:
      return 0x71374491
    case 2:
      return 0xb5c0fbcf
    case 3:
      return 0xe9b5dba5
    case 4:
      return 0x3956c25b
    case 5:
      return 0x59f111f1
    case 6:
      return 0x923f82a4
    case 7:
      return 0xab1c5ed5
    case 8:
      return 0xd807aa98
    case 9:
      return 0x12835b01
    case 10:
      return 0x243185be
    case 11:
      return 0x550c7dc3
    case 12:
      return 0x72be5d74
    case 13:
      return 0x80deb1fe
    case 14:
      return 0x9bdc06a7
    case 15:
      return 0xc19bf174
    case 16:
      return 0xe49b69c1
    case 17:
      return 0xefbe4786
    case 18:
      return 0x0fc19dc6
    case 19:
      return 0x240ca1cc
    case 20:
      return 0x2de92c6f
    case 21:
      return 0x4a7484aa
    case 22:
      return 0x5cb0a9dc
    case 23:
      return 0x76f988da
    case 24:
      return 0x983e5152
    case 25:
      return 0xa831c66d
    case 26:
      return 0xb00327c8
    case 27:
      return 0xbf597fc7
    case 28:
      return 0xc6e00bf3
    case 29:
      return 0xd5a79147
    case 30:
      return 0x06ca6351
    case 31:
      return 0x14292967
    case 32:
      return 0x27b70a85
    case 33:
      return 0x2e1b2138
    case 34:
      return 0x4d2c6dfc
    case 35:
      return 0x53380d13
    case 36:
      return 0x650a7354
    case 37:
      return 0x766a0abb
    case 38:
      return 0x81c2c92e
    case 39:
      return 0x92722c85
    case 40:
      return 0xa2bfe8a1
    case 41:
      return 0xa81a664b
    case 42:
      return 0xc24b8b70
    case 43:
      return 0xc76c51a3
    case 44:
      return 0xd192e819
    case 45:
      return 0xd6990624
    case 46:
      return 0xf40e3585
    case 47:
      return 0x106aa070
    case 48:
      return 0x19a4c116
    case 49:
      return 0x1e376c08
    case 50:
      return 0x2748774c
    case 51:
      return 0x34b0bcb5
    case 52:
      return 0x391c0cb3
    case 53:
      return 0x4ed8aa4a
    case 54:
      return 0x5b9cca4f
    case 55:
      return 0x682e6ff3
    case 56:
      return 0x748f82ee
    case 57:
      return 0x78a5636f
    case 58:
      return 0x84c87814
    case 59:
      return 0x8cc70208
    case 60:
      return 0x90befffa
    case 61:
      return 0xa4506ceb
    case 62:
      return 0xbef9a3f7
    default:
      return 0xc67178f2
  }
}

/** ROTR^n(x) of FIPS 180-4 §3.2: a right rotation of a 32-bit word, `0 < n < 32`. */
const sha256Rotr = (x: u32, n: u32): u32 => (x >>> n) | (x << (32 - n))

/** The big-endian word at `buf[at .. at + 4)`, as FIPS 180-4 §3.1 orders bytes in a word. */
const sha256LoadWord = (buf: u8[], at: i32): u32 =>
  (toU32(buf[at]) << 24) | (toU32(buf[at + 1]) << 16) | (toU32(buf[at + 2]) << 8) | toU32(buf[at + 3])

/**
 * Copies `from[fromAt .. fromAt + n)` to `to[toAt .. toAt + n)`. Every caller
 * has already checked both windows, so the indices here are in range; they
 * are computed from `k` so the loop has one counter.
 */
const sha256CopyBytes = (from: u8[], fromAt: i32, to: u8[], toAt: i32, n: i32): void => {
  for (let k: i32 = 0; k < n; k += 1) {
    to[toAt + k] = from[fromAt + k]
  }
}

/**
 * Folds the 64-byte block at `src[at .. at + 64)` into the hash value `h`: the
 * computation of FIPS 180-4 §6.2.2, steps 1 to 4, for one block. `w` is the
 * 64-word message schedule, passed in so that it is allocated once per hasher.
 *
 * A function over the arrays rather than a method, so that each array is a
 * plain local whose length the guard below proves once for every loop.
 */
const sha256Compress = (h: u32[], w: u32[], src: u8[], at: i32): void => {
  // The test is written as the condition the body runs under, not as an
  // early exit, because that is the shape that proves every index below in
  // range and lets the loops run without a bounds check each.
  if (toI32(h.length) >= 8 && toI32(w.length) >= 64 && at >= 0 && at <= toI32(src.length) - SHA256_BLOCK) {
    // Step 1: the message schedule.
    for (let t: i32 = 0; t < 16; t += 1) {
      w[t] = sha256LoadWord(src, at + 4 * t)
    }
    for (let t: i32 = 16; t < 64; t += 1) {
      const w2: u32 = w[t - 2]
      const w15: u32 = w[t - 15]
      // σ1 and σ0 of §4.1.2, (4.7) and (4.6).
      const sigma1: u32 = sha256Rotr(w2, 17) ^ sha256Rotr(w2, 19) ^ (w2 >>> 10)
      const sigma0: u32 = sha256Rotr(w15, 7) ^ sha256Rotr(w15, 18) ^ (w15 >>> 3)
      w[t] = sigma1 + w[t - 7] + sigma0 + w[t - 16]
    }
    // Step 2: the working variables start from the previous hash value.
    let a: u32 = h[0]
    let b: u32 = h[1]
    let c: u32 = h[2]
    let d: u32 = h[3]
    let e: u32 = h[4]
    let f: u32 = h[5]
    let g: u32 = h[6]
    let hh: u32 = h[7]
    // Step 3: sixty-four rounds.
    for (let t: i32 = 0; t < 64; t += 1) {
      // Σ1 (4.5), Ch (4.2), Σ0 (4.4) and Maj (4.3) of §4.1.2.
      const bigSigma1: u32 = sha256Rotr(e, 6) ^ sha256Rotr(e, 11) ^ sha256Rotr(e, 25)
      const choose: u32 = (e & f) ^ (~e & g)
      const t1: u32 = hh + bigSigma1 + choose + sha256RoundConstant(t) + w[t]
      const bigSigma0: u32 = sha256Rotr(a, 2) ^ sha256Rotr(a, 13) ^ sha256Rotr(a, 22)
      const majority: u32 = (a & b) ^ (a & c) ^ (b & c)
      const t2: u32 = bigSigma0 + majority
      hh = g
      g = f
      f = e
      e = d + t1
      d = c
      c = b
      b = a
      a = t1 + t2
    }
    // Step 4: the next intermediate hash value.
    h[0] += a
    h[1] += b
    h[2] += c
    h[3] += d
    h[4] += e
    h[5] += f
    h[6] += g
    h[7] += hh
  } else {
    panic("Sha256: a block outside its buffer")
  }
}

/**
 * A SHA-256 computation in progress: the hash value H of FIPS 180-4 §6.2 after
 * every whole block absorbed so far, and the bytes of the block not yet whole.
 *
 * `update` may be called any number of times with windows of any length, and
 * the digest does not depend on where the message was split. `digest` pads the
 * message (§5.1.1), runs the last block or two, and ends the computation: the
 * padding is written into this hasher's own state, so a second `digest`, a
 * later `update` or a `copy` would carry the padding as message, and all three
 * panic instead of answering a wrong value. `copy` first when the computation
 * has to go on.
 */
export class Sha256 {
  /**
   * The message length absorbed so far, in bytes. An `i64` because §5.1.1
   * appends the length in bits as a 64-bit number, and a transcript can pass
   * 2^31 bytes where an `i32` would wrap.
   */
  total: i64 = 0
  /** H_0 .. H_7, the eight words of the intermediate hash value (§6.2.2 step 4). */
  state: u32[]
  /** The pending bytes of the current block; the first `fill` of them are live. */
  block: u8[]
  /**
   * W_0 .. W_63, the message schedule of §6.2.2 step 1. It carries nothing from
   * one block to the next and is a field only so that a long message allocates
   * it once rather than once per block.
   */
  schedule: u32[]
  /** How many bytes of `block` are live, always below `SHA256_BLOCK` between calls. */
  fill: i32 = 0
  finished: boolean = false

  constructor() {
    // H^(0) of FIPS 180-4 §5.3.3: the first 32 bits of the fractional parts
    // of the square roots of the first eight primes.
    const h: u32[] = new Array<u32>(8)
    h[0] = 0x6a09e667
    h[1] = 0xbb67ae85
    h[2] = 0x3c6ef372
    h[3] = 0xa54ff53a
    h[4] = 0x510e527f
    h[5] = 0x9b05688c
    h[6] = 0x1f83d9ab
    h[7] = 0x5be0cd19
    this.state = h
    this.block = new Array<u8>(SHA256_BLOCK)
    this.schedule = new Array<u32>(64)
  }

  /**
   * Absorbs `data[off .. off + len)`. A window outside `data` panics rather
   * than hashing a short read, since a digest over the wrong bytes looks
   * exactly like a digest over the right ones.
   */
  update(data: u8[], off: i32, len: i32): void {
    if (this.finished) {
      panic("Sha256: update after digest")
    }
    const size: i32 = toI32(data.length)
    if (off < 0 || len < 0 || off > size || len > size - off) {
      panic("Sha256: the window is outside the buffer")
    }
    this.total += toI64(len)
    let at: i32 = off
    const end: i32 = off + len
    const block: u8[] = this.block
    // Top up a partly filled block first, so that the loop below only ever
    // starts at a block boundary.
    if (this.fill > 0) {
      const room: i32 = SHA256_BLOCK - this.fill
      const take: i32 = len < room ? len : room
      sha256CopyBytes(data, at, block, this.fill, take)
      at += take
      this.fill += take
      if (this.fill < SHA256_BLOCK) {
        return
      }
      sha256Compress(this.state, this.schedule, block, 0)
      this.fill = 0
    }
    // Whole blocks are compressed straight out of the caller's buffer, with no
    // copy through `block`.
    while (end - at >= SHA256_BLOCK) {
      sha256Compress(this.state, this.schedule, data, at)
      at += SHA256_BLOCK
    }
    sha256CopyBytes(data, at, block, 0, end - at)
    this.fill = end - at
  }

  /**
   * An independent hasher at the same point in the same message: updating or
   * digesting either one leaves the other as it was. This is how a caller
   * takes the hash of a prefix and keeps going.
   */
  copy(): Sha256 {
    if (this.finished) {
      panic("Sha256: copy after digest")
    }
    const twin: Sha256 = new Sha256()
    const fromState: u32[] = this.state
    const toState: u32[] = twin.state
    // Both are always eight words; the test is what proves the indices below
    // in range, as it does in `sha256Compress`.
    if (toI32(fromState.length) >= 8 && toI32(toState.length) >= 8) {
      for (let i: i32 = 0; i < 8; i += 1) {
        toState[i] = fromState[i]
      }
    } else {
      panic("Sha256: a hash value that is not eight words")
    }
    sha256CopyBytes(this.block, 0, twin.block, 0, this.fill)
    twin.fill = this.fill
    twin.total = this.total
    return twin
  }

  /**
   * The 32-byte message digest (FIPS 180-4 §6.2.2, the final H^(N) in
   * big-endian order), in a fresh array. Ends the computation.
   */
  digest(): u8[] {
    if (this.finished) {
      panic("Sha256: digest called twice")
    }
    this.finished = true
    // §5.1.1: a single 1 bit, then zeros up to 56 bytes into a block, then the
    // message length in bits as a big-endian 64-bit number. When fewer than
    // eight bytes are left after the 1 bit, the zeros run into a second block.
    // `block` is zero past `fill` only in a fresh hasher, so every zero is
    // written rather than assumed.
    const block: u8[] = this.block
    const blockEnd: i32 = toI32(block.length)
    const fill: i32 = this.fill
    block[fill] = 0x80
    for (let i: i32 = fill + 1; i < blockEnd; i += 1) {
      block[i] = 0
    }
    if (fill >= SHA256_BLOCK - 8) {
      sha256Compress(this.state, this.schedule, block, 0)
      for (let i: i32 = 0; i < blockEnd; i += 1) {
        block[i] = 0
      }
    }
    const bits: u64 = toU64(this.total) << 3
    for (let i: i32 = 0; i < 8; i += 1) {
      block[SHA256_BLOCK - 1 - i] = toU8(bits >>> toU64(8 * i))
    }
    sha256Compress(this.state, this.schedule, block, 0)
    const out: u8[] = new Array<u8>(SHA256_SIZE)
    const state: u32[] = this.state
    const words: i32 = toI32(state.length)
    for (let i: i32 = 0; i < words; i += 1) {
      const word: u32 = state[i]
      out[4 * i] = toU8(word >>> 24)
      out[4 * i + 1] = toU8(word >>> 16)
      out[4 * i + 2] = toU8(word >>> 8)
      out[4 * i + 3] = toU8(word)
    }
    return out
  }
}

/** The SHA-256 digest of all of `data`, as a fresh 32-byte array. */
export const sha256 = (data: u8[]): u8[] => {
  const hasher: Sha256 = new Sha256()
  const from: i32 = 0
  hasher.update(data, from, toI32(data.length))
  return hasher.digest()
}

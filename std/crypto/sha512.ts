/**
 * `nish/crypto/sha512` — SHA-512 and SHA-384, written from FIPS 180-4.
 *
 *     import { sha512, sha384, Sha512 } from "nish/crypto/sha512";
 *
 *     const whole: u8[] = sha512(message); // 64 bytes; sha384 answers 48
 *
 *     const h = new Sha512();
 *     h.update(first, 0, toI32(first.length));
 *     h.update(second, 0, toI32(second.length));
 *     const all: u8[] = h.digest();
 *
 * **One engine, two hashes.** Both hashes are one compression function over
 * eight 64-bit words: SHA-384 starts from its own initial value (§5.3.4) and
 * keeps the first 48 bytes of the result (§6.5), SHA-512 starts from §5.3.5 and
 * keeps all 64. So one engine does the work, and `Sha512` and `Sha384` are the
 * two ways to start it.
 *
 * **Time says only the length.** A hasher streams: `update` any number of
 * windows, `copy` to take an independent hasher at the same point (TLS 1.3
 * hashes its transcript and reads intermediate hashes of it), then `digest`
 * once. The work depends on how many bytes arrive and never on their values:
 * there is no branch and no table index on message data, so a secret message
 * (an HMAC key, a transcript) is hashed in time that says nothing about it but
 * its length.
 *
 * The constants are the fractional parts of the cube roots of the first eighty
 * primes (§4.2.3) and of the square roots of the first sixteen (§5.3.4, §5.3.5),
 * as FIPS 180-4 defines them. A literal past 2^53 cannot be written exactly, so
 * each is spelled as its two 32-bit halves.
 */

/** The length of a SHA-512 digest, in bytes. */
export const SHA512_SIZE: i32 = 64
/** The length of a SHA-384 digest, in bytes. */
export const SHA384_SIZE: i32 = 48
/** The block both hashes compress, in bytes. */
export const SHA512_BLOCK: i32 = 128

/** The block offset at which padding writes the 128-bit message length (§5.1.2). */
const LENGTH_AT: i32 = 112

/** SHA-512's rounds per block, and so the length of its message schedule (§6.4.2). */
const ROUNDS: i32 = 80

/** Offset zero, spelled as an `i32` so a method argument keeps that type in f64 mode (`reject_method_arg_literal`). */
const OFFSET_ZERO: i32 = 0

const w64 = (hi: u32, lo: u32): u64 => (toU64(hi) << 32) | toU64(lo)

/** ROTR^n (§3.2), for 0 < n < 64. */
const rotr = (x: u64, n: u64): u64 => (x >> n) | (x << (64 - n))

// The four functions of §4.1.3.
const bigSigma0 = (x: u64): u64 => rotr(x, 28) ^ rotr(x, 34) ^ rotr(x, 39)
const bigSigma1 = (x: u64): u64 => rotr(x, 14) ^ rotr(x, 18) ^ rotr(x, 41)
const smallSigma0 = (x: u64): u64 => rotr(x, 1) ^ rotr(x, 8) ^ (x >> 7)
const smallSigma1 = (x: u64): u64 => rotr(x, 19) ^ rotr(x, 61) ^ (x >> 6)

/**
 * K{512}_t (§4.2.3): the first 64 bits of the fractional parts of the cube
 * roots of the first eighty primes.
 *
 * A function over a `switch` rather than an array, because a module constant
 * cannot be an array and building one per hasher costs eighty stores on every
 * `new` and every `copy()`. Every arm is a constant once `w64` folds, and LLVM
 * turns such a `switch` into one read-only table, so a round reads K with one
 * load. `t` is the round number, never message data.
 */
const roundConstant = (t: i32): u64 => {
  switch (t) {
    case 0:
      return w64(0x428a2f98, 0xd728ae22)
    case 1:
      return w64(0x71374491, 0x23ef65cd)
    case 2:
      return w64(0xb5c0fbcf, 0xec4d3b2f)
    case 3:
      return w64(0xe9b5dba5, 0x8189dbbc)
    case 4:
      return w64(0x3956c25b, 0xf348b538)
    case 5:
      return w64(0x59f111f1, 0xb605d019)
    case 6:
      return w64(0x923f82a4, 0xaf194f9b)
    case 7:
      return w64(0xab1c5ed5, 0xda6d8118)
    case 8:
      return w64(0xd807aa98, 0xa3030242)
    case 9:
      return w64(0x12835b01, 0x45706fbe)
    case 10:
      return w64(0x243185be, 0x4ee4b28c)
    case 11:
      return w64(0x550c7dc3, 0xd5ffb4e2)
    case 12:
      return w64(0x72be5d74, 0xf27b896f)
    case 13:
      return w64(0x80deb1fe, 0x3b1696b1)
    case 14:
      return w64(0x9bdc06a7, 0x25c71235)
    case 15:
      return w64(0xc19bf174, 0xcf692694)
    case 16:
      return w64(0xe49b69c1, 0x9ef14ad2)
    case 17:
      return w64(0xefbe4786, 0x384f25e3)
    case 18:
      return w64(0x0fc19dc6, 0x8b8cd5b5)
    case 19:
      return w64(0x240ca1cc, 0x77ac9c65)
    case 20:
      return w64(0x2de92c6f, 0x592b0275)
    case 21:
      return w64(0x4a7484aa, 0x6ea6e483)
    case 22:
      return w64(0x5cb0a9dc, 0xbd41fbd4)
    case 23:
      return w64(0x76f988da, 0x831153b5)
    case 24:
      return w64(0x983e5152, 0xee66dfab)
    case 25:
      return w64(0xa831c66d, 0x2db43210)
    case 26:
      return w64(0xb00327c8, 0x98fb213f)
    case 27:
      return w64(0xbf597fc7, 0xbeef0ee4)
    case 28:
      return w64(0xc6e00bf3, 0x3da88fc2)
    case 29:
      return w64(0xd5a79147, 0x930aa725)
    case 30:
      return w64(0x06ca6351, 0xe003826f)
    case 31:
      return w64(0x14292967, 0x0a0e6e70)
    case 32:
      return w64(0x27b70a85, 0x46d22ffc)
    case 33:
      return w64(0x2e1b2138, 0x5c26c926)
    case 34:
      return w64(0x4d2c6dfc, 0x5ac42aed)
    case 35:
      return w64(0x53380d13, 0x9d95b3df)
    case 36:
      return w64(0x650a7354, 0x8baf63de)
    case 37:
      return w64(0x766a0abb, 0x3c77b2a8)
    case 38:
      return w64(0x81c2c92e, 0x47edaee6)
    case 39:
      return w64(0x92722c85, 0x1482353b)
    case 40:
      return w64(0xa2bfe8a1, 0x4cf10364)
    case 41:
      return w64(0xa81a664b, 0xbc423001)
    case 42:
      return w64(0xc24b8b70, 0xd0f89791)
    case 43:
      return w64(0xc76c51a3, 0x0654be30)
    case 44:
      return w64(0xd192e819, 0xd6ef5218)
    case 45:
      return w64(0xd6990624, 0x5565a910)
    case 46:
      return w64(0xf40e3585, 0x5771202a)
    case 47:
      return w64(0x106aa070, 0x32bbd1b8)
    case 48:
      return w64(0x19a4c116, 0xb8d2d0c8)
    case 49:
      return w64(0x1e376c08, 0x5141ab53)
    case 50:
      return w64(0x2748774c, 0xdf8eeb99)
    case 51:
      return w64(0x34b0bcb5, 0xe19b48a8)
    case 52:
      return w64(0x391c0cb3, 0xc5c95a63)
    case 53:
      return w64(0x4ed8aa4a, 0xe3418acb)
    case 54:
      return w64(0x5b9cca4f, 0x7763e373)
    case 55:
      return w64(0x682e6ff3, 0xd6b2b8a3)
    case 56:
      return w64(0x748f82ee, 0x5defb2fc)
    case 57:
      return w64(0x78a5636f, 0x43172f60)
    case 58:
      return w64(0x84c87814, 0xa1f0ab72)
    case 59:
      return w64(0x8cc70208, 0x1a6439ec)
    case 60:
      return w64(0x90befffa, 0x23631e28)
    case 61:
      return w64(0xa4506ceb, 0xde82bde9)
    case 62:
      return w64(0xbef9a3f7, 0xb2c67915)
    case 63:
      return w64(0xc67178f2, 0xe372532b)
    case 64:
      return w64(0xca273ece, 0xea26619c)
    case 65:
      return w64(0xd186b8c7, 0x21c0c207)
    case 66:
      return w64(0xeada7dd6, 0xcde0eb1e)
    case 67:
      return w64(0xf57d4f7f, 0xee6ed178)
    case 68:
      return w64(0x06f067aa, 0x72176fba)
    case 69:
      return w64(0x0a637dc5, 0xa2c898a6)
    case 70:
      return w64(0x113f9804, 0xbef90dae)
    case 71:
      return w64(0x1b710b35, 0x131c471b)
    case 72:
      return w64(0x28db77f5, 0x23047d84)
    case 73:
      return w64(0x32caab7b, 0x40c72493)
    case 74:
      return w64(0x3c9ebe0a, 0x15c9bebc)
    case 75:
      return w64(0x431d67c4, 0x9c100d4c)
    case 76:
      return w64(0x4cc5d4be, 0xcb3e42b6)
    case 77:
      return w64(0x597f299c, 0xfc657e2a)
    case 78:
      return w64(0x5fcb6fab, 0x3ad6faec)
    case 79:
      return w64(0x6c44198c, 0x4a475817)
    // Unreachable: `t` is a round number, 0 to 79. A `default` of its own
    // keeps K_79 inside the table, so the lookup needs no range test first.
    default:
      return 0
  }
}

/** H(0) for SHA-512 (§5.3.5). */
const sha512Initial = (): u64[] => [
  w64(0x6a09e667, 0xf3bcc908),
  w64(0xbb67ae85, 0x84caa73b),
  w64(0x3c6ef372, 0xfe94f82b),
  w64(0xa54ff53a, 0x5f1d36f1),
  w64(0x510e527f, 0xade682d1),
  w64(0x9b05688c, 0x2b3e6c1f),
  w64(0x1f83d9ab, 0xfb41bd6b),
  w64(0x5be0cd19, 0x137e2179),
]

/** H(0) for SHA-384 (§5.3.4). */
const sha384Initial = (): u64[] => [
  w64(0xcbbb9d5d, 0xc1059ed8),
  w64(0x629a292a, 0x367cd507),
  w64(0x9159015a, 0x3070dd17),
  w64(0x152fecd8, 0xf70e5939),
  w64(0x67332667, 0xffc00b31),
  w64(0x8eb44a87, 0x68581511),
  w64(0xdb0c2e0d, 0x64f98fa7),
  w64(0x47b5481d, 0xbefa4fa4),
]

/**
 * The state both hashes share: the hash value, the partial block, and the
 * message length in bytes. §5.1.2 appends the length in bits as 128 bits; a
 * byte count in a `u64` shifted left by three fills those 128 bits for any
 * message shorter than 2^64 bytes, which is every message there can be.
 *
 * No index in it is checked at run time: each read and write sits under a
 * loop or block condition that proves it in range, and every caller's
 * arguments make that condition hold.
 */
class Sha512Engine {
  state: u64[]
  block: u8[]
  /** The message schedule W_0 .. W_79, kept so a block allocates nothing. */
  schedule: u64[]
  /** @internal Set by `nish/crypto/hmac` when it wipes, copies or restarts a hasher. */
  count: u64 = 0
  /** @internal Set by `nish/crypto/hmac` when it wipes, copies or restarts a hasher. */
  filled: i32 = 0
  /** @internal Set by `nish/crypto/hmac` when it wipes, copies or restarts a hasher. */
  finished: boolean = false

  constructor(initial: u64[]) {
    this.state = initial
    this.block = new Array<u8>(SHA512_BLOCK)
    this.schedule = new Array<u64>(ROUNDS)
  }

  /** One application of §6.4.2 to the block at `src[off]` .. `src[off + 127]`. */
  private compress(src: u8[], off: i32): void {
    const w = this.schedule
    const h = this.state
    const n: i32 = toI32(src.length)
    if (toI32(h.length) >= 8 && toI32(w.length) >= 80) {
      // Step 1: the sixteen big-endian words of the block (§3.1), then the
      // rest of the schedule. `p < n - 7` proves each `src[p + k]`.
      let p: i32 = off
      for (let t: i32 = 0; t < 16 && p >= 0 && p < n - 7; t++) {
        w[t] =
          (toU64(src[p]) << 56) |
          (toU64(src[p + 1]) << 48) |
          (toU64(src[p + 2]) << 40) |
          (toU64(src[p + 3]) << 32) |
          (toU64(src[p + 4]) << 24) |
          (toU64(src[p + 5]) << 16) |
          (toU64(src[p + 6]) << 8) |
          toU64(src[p + 7])
        p += 8
      }
      for (let t: i32 = 16; t < 80; t++) {
        // Named offsets rather than `w[t - 2]`, so the bounds prover sees each index.
        const t2: i32 = t - 2
        const t7: i32 = t - 7
        const t15: i32 = t - 15
        const t16: i32 = t - 16
        w[t] = smallSigma1(w[t2]) + w[t7] + smallSigma0(w[t15]) + w[t16]
      }
      let a = h[0]
      let b = h[1]
      let c = h[2]
      let d = h[3]
      let e = h[4]
      let f = h[5]
      let g = h[6]
      let hh = h[7]
      // §6.4.2 step 4, eight rounds per pass. Rather than shift eight words down
      // each round, the rounds rename them: T1 accumulates in the word that
      // becomes the new `a`, and the word that becomes the new `e` is `d + T1`,
      // so after eight rounds every word is back in its own name. Each index is
      // `u` minus a constant, which the bounds prover can see; `u + 1` it cannot.
      for (let u: i32 = 7; u < 80; u += 8) {
        const r0: i32 = u - 7
        const r1: i32 = u - 6
        const r2: i32 = u - 5
        const r3: i32 = u - 4
        const r4: i32 = u - 3
        const r5: i32 = u - 2
        const r6: i32 = u - 1
        hh = hh + bigSigma1(e) + ((e & f) ^ (~e & g)) + roundConstant(r0) + w[r0]
        d = d + hh
        hh = hh + bigSigma0(a) + ((a & b) ^ (a & c) ^ (b & c))
        g = g + bigSigma1(d) + ((d & e) ^ (~d & f)) + roundConstant(r1) + w[r1]
        c = c + g
        g = g + bigSigma0(hh) + ((hh & a) ^ (hh & b) ^ (a & b))
        f = f + bigSigma1(c) + ((c & d) ^ (~c & e)) + roundConstant(r2) + w[r2]
        b = b + f
        f = f + bigSigma0(g) + ((g & hh) ^ (g & a) ^ (hh & a))
        e = e + bigSigma1(b) + ((b & c) ^ (~b & d)) + roundConstant(r3) + w[r3]
        a = a + e
        e = e + bigSigma0(f) + ((f & g) ^ (f & hh) ^ (g & hh))
        d = d + bigSigma1(a) + ((a & b) ^ (~a & c)) + roundConstant(r4) + w[r4]
        hh = hh + d
        d = d + bigSigma0(e) + ((e & f) ^ (e & g) ^ (f & g))
        c = c + bigSigma1(hh) + ((hh & a) ^ (~hh & b)) + roundConstant(r5) + w[r5]
        g = g + c
        c = c + bigSigma0(d) + ((d & e) ^ (d & f) ^ (e & f))
        b = b + bigSigma1(g) + ((g & hh) ^ (~g & a)) + roundConstant(r6) + w[r6]
        f = f + b
        b = b + bigSigma0(c) + ((c & d) ^ (c & e) ^ (d & e))
        a = a + bigSigma1(f) + ((f & g) ^ (~f & hh)) + roundConstant(u) + w[u]
        e = e + a
        a = a + bigSigma0(b) + ((b & c) ^ (b & d) ^ (c & d))
      }
      h[0] = h[0] + a
      h[1] = h[1] + b
      h[2] = h[2] + c
      h[3] = h[3] + d
      h[4] = h[4] + e
      h[5] = h[5] + f
      h[6] = h[6] + g
      h[7] = h[7] + hh
    }
  }

  /**
   * Absorbs `data[off .. off + len)`: `false`, absorbing nothing, for a window
   * outside `data` or an engine `finish` has ended.
   *
   * @internal Called by `Sha512` and `Sha384`, which hold the engine.
   */
  absorb(data: u8[], off: i32, len: i32): boolean {
    const size: i32 = toI32(data.length)
    if (this.finished || off < 0 || len < 0 || off > size - len) {
      return false
    }
    this.count = this.count + toU64(len)
    const block: u8[] = this.block
    const room: i32 = toI32(block.length)
    let at: i32 = off
    let left: i32 = len
    let fill: i32 = this.filled
    // Top up a partly filled block first, so that the loop below only ever
    // starts at a block boundary. Each loop's condition beyond its count is
    // what proves its indices in range; the window check above makes it hold.
    if (fill > 0) {
      while (left > 0 && fill >= 0 && fill < SHA512_BLOCK && fill < room && at >= 0 && at < size) {
        block[fill] = data[at]
        fill += 1
        at += 1
        left -= 1
      }
      if (fill < SHA512_BLOCK) {
        this.filled = fill
        return true
      }
      this.compress(block, OFFSET_ZERO)
    }
    while (left >= 128 && at >= 0 && at <= size - 128) {
      this.compress(data, at)
      at += 128
      left -= 128
    }
    fill = 0
    while (fill < left && fill < room && at >= 0 && at < size) {
      block[fill] = data[at]
      fill += 1
      at += 1
    }
    this.filled = fill
    return true
  }

  /**
   * Absorbs all of `data`. An array of up to 2^31 - 1 bytes goes through
   * `absorb`. A longer one (possible under `--number-mode f64`, where `toI32`
   * of its length would saturate and leave a prefix) is walked with a `number`
   * offset instead, a block at a time through `block`, so it is absorbed
   * whole. After `finish` it answers `false`, absorbing nothing, as `absorb`
   * does; otherwise `true`.
   *
   * @internal Called by `sha512`, `sha384` and `nish/crypto/hmac`.
   */
  absorbAll(data: u8[]): boolean {
    const n: number = data.length
    if (this.finished) {
      return false
    }
    if (n <= 2147483647) {
      return this.absorb(data, OFFSET_ZERO, toI32(n))
    }
    this.count += toU64(toI64(n))
    const block: u8[] = this.block
    const room: i32 = toI32(block.length)
    let fill: i32 = this.filled
    let off: number = 0
    while (true) {
      while (fill >= 0 && fill < SHA512_BLOCK && fill < room && off >= 0 && off < n) {
        block[fill] = data[off]
        fill += 1
        off += 1
      }
      if (fill < SHA512_BLOCK) {
        this.filled = fill
        return true
      }
      this.compress(block, OFFSET_ZERO)
      fill = 0
    }
  }

  /**
   * Makes `twin` this engine at the same point. `twin` is a fresh engine of the
   * same hash, so its arrays are reused rather than allocated a second time.
   *
   * @internal Called by `Sha512` and `Sha384`, which hold the engine.
   */
  copyInto(twin: Sha512Engine): void {
    const from: u64[] = this.state
    const to: u64[] = twin.state
    for (let i: i32 = 0; i < 8 && i < toI32(from.length) && i < toI32(to.length); i++) {
      to[i] = from[i]
    }
    const fill: i32 = this.filled
    const src: u8[] = this.block
    const dst: u8[] = twin.block
    for (let i: i32 = 0; i < fill && i < toI32(src.length) && i < toI32(dst.length); i++) {
      dst[i] = src[i]
    }
    twin.filled = fill
    twin.count = this.count
    twin.finished = this.finished
  }

  /**
   * Pads (§5.1.2), compresses what is left, and writes the first
   * `out.length / 8` words of H(N) (§6.4.2, §6.5), at most eight, into `out`.
   * A second call writes the same words: the padding is absorbed once.
   *
   * @internal Called by `Sha512` and `Sha384`, which hold the engine.
   */
  finish(out: u8[]): void {
    if (!this.finished) {
      this.pad()
    }
    // Both sizes are whole words, so the digest is the first `out.length / 8`.
    const state: u64[] = this.state
    const size: i32 = toI32(out.length)
    let p: i32 = 0
    for (let i: i32 = 0; i < 8 && i < toI32(state.length) && p < size - 7; i++) {
      const word: u64 = state[i]
      out[p] = toU8(word >> 56)
      out[p + 1] = toU8(word >> 48)
      out[p + 2] = toU8(word >> 40)
      out[p + 3] = toU8(word >> 32)
      out[p + 4] = toU8(word >> 24)
      out[p + 5] = toU8(word >> 16)
      out[p + 6] = toU8(word >> 8)
      out[p + 7] = toU8(word)
      p += 8
    }
  }

  /** Appends the padding and the length (§5.1.2) and compresses them: `finish`'s first call. */
  private pad(): void {
    this.finished = true
    const block = this.block
    const room: i32 = toI32(block.length)
    const fill: i32 = this.filled
    // The 0x80 that ends the message, then zeros to the end of the block.
    for (let i: i32 = fill; i >= 0 && i < room; i++) {
      block[i] = i === fill ? 0x80 : 0
    }
    if (fill >= LENGTH_AT) {
      this.compress(block, OFFSET_ZERO)
      for (let i: i32 = 0; i < LENGTH_AT && i < room; i++) {
        block[i] = 0
      }
    }
    // The length in bits, big-endian in the last 16 bytes: the top 64 bits are
    // `count >> 61`, the bottom 64 are `count << 3`.
    const high: u64 = this.count >> 61
    const low: u64 = this.count << 3
    let shift: u64 = 0
    for (let i: i32 = 127; i >= 120 && i < room; i--) {
      block[i] = toU8(low >> shift)
      block[i - 8] = toU8(high >> shift)
      shift += 8
    }
    this.compress(block, OFFSET_ZERO)
  }
}

/**
 * A streaming SHA-512 hasher. `update` takes a window `(data, off, len)`;
 * `digest` answers a fresh 64-byte array and ends the message: a later
 * `update` answers `false` and absorbs nothing, and a later `digest` answers
 * the same digest.
 */
export class Sha512 {
  /**
   * The engine the hash runs on. `nish/crypto/hmac` and `nish/crypto/ed25519`
   * reach into it to wipe a hasher, and the tests to check the wipe; a caller
   * has no use for it.
   */
  engine: Sha512Engine

  /**
   * A hasher at the start of an empty message (FIPS 180-4 §5.3.5's initial hash
   * value).
   */
  constructor() {
    this.engine = new Sha512Engine(sha512Initial())
  }

  /**
   * Absorbs `data[off .. off + len)`. A window outside `data`, or an update
   * after `digest`, answers `false` and absorbs nothing: check it, since a
   * digest over the wrong bytes looks exactly like one over the right ones.
   *
   * @param data The buffer holding the window; it is read, not kept.
   * @param off Where the window starts in `data`.
   * @param len How many bytes to absorb; 0 absorbs nothing.
   * @returns `true` once the window is absorbed; `false`, absorbing nothing,
   *   for a window outside `data` or a hasher already digested.
   */
  update(data: u8[], off: i32, len: i32): boolean {
    return this.engine.absorb(data, off, len)
  }

  /**
   * An independent hasher at the same point: updating either leaves the other
   * alone.
   *
   * @returns A new hasher with its own engine; it shares no array with this
   *   one.
   */
  copy(): Sha512 {
    const twin = new Sha512()
    this.engine.copyInto(twin.engine)
    return twin
  }

  /**
   * Pads the message (§5.1.2) and answers its digest. Ends the computation: a
   * second `digest` answers the same digest.
   *
   * @returns A fresh 64-byte digest, which the caller owns.
   */
  digest(): u8[] {
    const out: u8[] = new Array<u8>(SHA512_SIZE)
    this.engine.finish(out)
    return out
  }
}

/**
 * A streaming SHA-384 hasher, with `Sha512`'s methods. `digest` answers a
 * fresh 48-byte array.
 */
export class Sha384 {
  /**
   * The engine the hash runs on. `nish/crypto/hmac` and `nish/crypto/ed25519`
   * reach into it to wipe a hasher, and the tests to check the wipe; a caller
   * has no use for it.
   */
  engine: Sha512Engine

  /**
   * A hasher at the start of an empty message (FIPS 180-4 §5.3.4's initial hash
   * value).
   */
  constructor() {
    this.engine = new Sha512Engine(sha384Initial())
  }

  /**
   * Absorbs `data[off .. off + len)`. A window outside `data`, or an update
   * after `digest`, answers `false` and absorbs nothing: check it, since a
   * digest over the wrong bytes looks exactly like one over the right ones.
   *
   * @param data The buffer holding the window; it is read, not kept.
   * @param off Where the window starts in `data`.
   * @param len How many bytes to absorb; 0 absorbs nothing.
   * @returns `true` once the window is absorbed; `false`, absorbing nothing,
   *   for a window outside `data` or a hasher already digested.
   */
  update(data: u8[], off: i32, len: i32): boolean {
    return this.engine.absorb(data, off, len)
  }

  /**
   * An independent hasher at the same point: updating either leaves the other
   * alone.
   *
   * @returns A new hasher with its own engine; it shares no array with this
   *   one.
   */
  copy(): Sha384 {
    const twin = new Sha384()
    this.engine.copyInto(twin.engine)
    return twin
  }

  /**
   * Pads the message (§5.1.2) and answers its digest, the first 48 bytes of the
   * final hash value (§6.5). Ends the computation: a second `digest` answers
   * the same digest.
   *
   * @returns A fresh 48-byte digest, which the caller owns.
   */
  digest(): u8[] {
    const out: u8[] = new Array<u8>(SHA384_SIZE)
    this.engine.finish(out)
    return out
  }
}

/**
 * The SHA-512 digest of all of `data`, as a fresh 64-byte array. An array
 * longer than 2^31 - 1 bytes (possible under `--number-mode f64`) is hashed
 * whole, never cut to a prefix.
 *
 * @param data The whole message; it is read, not changed.
 * @returns A fresh 64-byte digest.
 */
export const sha512 = (data: u8[]): u8[] => {
  const hasher = new Sha512()
  hasher.engine.absorbAll(data)
  return hasher.digest()
}

/**
 * The SHA-384 digest of all of `data`, as a fresh 48-byte array. An array
 * longer than 2^31 - 1 bytes is hashed whole, as in `sha512`.
 *
 * @param data The whole message; it is read, not changed.
 * @returns A fresh 48-byte digest.
 */
export const sha384 = (data: u8[]): u8[] => {
  const hasher = new Sha384()
  hasher.engine.absorbAll(data)
  return hasher.digest()
}

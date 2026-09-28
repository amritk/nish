/**
 * `nish/crypto/sha512` — SHA-512 and SHA-384, written from FIPS 180-4.
 *
 * Both hashes are one compression function over eight 64-bit words: SHA-384
 * starts from its own initial value (§5.3.4) and keeps the first 48 bytes of
 * the result (§6.5), SHA-512 starts from §5.3.5 and keeps all 64. So one
 * engine does the work, and `Sha512` and `Sha384` are the two ways to start it.
 *
 * A hasher streams: `update` any number of windows, `copy` to take an
 * independent hasher at the same point (TLS 1.3 hashes its transcript and
 * reads intermediate hashes of it), then `digest` once. The work depends on how
 * many bytes arrive and never on their values: there is no branch and no table
 * index on message data, so a secret message (an HMAC key, a transcript) is
 * hashed in time that says nothing about it but its length.
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

/** Offset zero, spelled as an `i32` so a method argument keeps that type in f64 mode. */
const BLOCK_START: i32 = 0

const w64 = (hi: u32, lo: u32): u64 => (toU64(hi) << 32) | toU64(lo)

/** ROTR^n (§3.2), for 0 < n < 64. */
const rotr = (x: u64, n: u64): u64 => (x >> n) | (x << (64 - n))

// The four functions of §4.1.3.
const bigSigma0 = (x: u64): u64 => rotr(x, 28) ^ rotr(x, 34) ^ rotr(x, 39)
const bigSigma1 = (x: u64): u64 => rotr(x, 14) ^ rotr(x, 18) ^ rotr(x, 41)
const smallSigma0 = (x: u64): u64 => rotr(x, 1) ^ rotr(x, 8) ^ (x >> 7)
const smallSigma1 = (x: u64): u64 => rotr(x, 19) ^ rotr(x, 61) ^ (x >> 6)

/** K{512}_0 .. K{512}_79 (§4.2.3). A module constant cannot be an array, so this builds it. */
const roundConstants = (): u64[] => [
  w64(0x428a2f98, 0xd728ae22),
  w64(0x71374491, 0x23ef65cd),
  w64(0xb5c0fbcf, 0xec4d3b2f),
  w64(0xe9b5dba5, 0x8189dbbc),
  w64(0x3956c25b, 0xf348b538),
  w64(0x59f111f1, 0xb605d019),
  w64(0x923f82a4, 0xaf194f9b),
  w64(0xab1c5ed5, 0xda6d8118),
  w64(0xd807aa98, 0xa3030242),
  w64(0x12835b01, 0x45706fbe),
  w64(0x243185be, 0x4ee4b28c),
  w64(0x550c7dc3, 0xd5ffb4e2),
  w64(0x72be5d74, 0xf27b896f),
  w64(0x80deb1fe, 0x3b1696b1),
  w64(0x9bdc06a7, 0x25c71235),
  w64(0xc19bf174, 0xcf692694),
  w64(0xe49b69c1, 0x9ef14ad2),
  w64(0xefbe4786, 0x384f25e3),
  w64(0x0fc19dc6, 0x8b8cd5b5),
  w64(0x240ca1cc, 0x77ac9c65),
  w64(0x2de92c6f, 0x592b0275),
  w64(0x4a7484aa, 0x6ea6e483),
  w64(0x5cb0a9dc, 0xbd41fbd4),
  w64(0x76f988da, 0x831153b5),
  w64(0x983e5152, 0xee66dfab),
  w64(0xa831c66d, 0x2db43210),
  w64(0xb00327c8, 0x98fb213f),
  w64(0xbf597fc7, 0xbeef0ee4),
  w64(0xc6e00bf3, 0x3da88fc2),
  w64(0xd5a79147, 0x930aa725),
  w64(0x06ca6351, 0xe003826f),
  w64(0x14292967, 0x0a0e6e70),
  w64(0x27b70a85, 0x46d22ffc),
  w64(0x2e1b2138, 0x5c26c926),
  w64(0x4d2c6dfc, 0x5ac42aed),
  w64(0x53380d13, 0x9d95b3df),
  w64(0x650a7354, 0x8baf63de),
  w64(0x766a0abb, 0x3c77b2a8),
  w64(0x81c2c92e, 0x47edaee6),
  w64(0x92722c85, 0x1482353b),
  w64(0xa2bfe8a1, 0x4cf10364),
  w64(0xa81a664b, 0xbc423001),
  w64(0xc24b8b70, 0xd0f89791),
  w64(0xc76c51a3, 0x0654be30),
  w64(0xd192e819, 0xd6ef5218),
  w64(0xd6990624, 0x5565a910),
  w64(0xf40e3585, 0x5771202a),
  w64(0x106aa070, 0x32bbd1b8),
  w64(0x19a4c116, 0xb8d2d0c8),
  w64(0x1e376c08, 0x5141ab53),
  w64(0x2748774c, 0xdf8eeb99),
  w64(0x34b0bcb5, 0xe19b48a8),
  w64(0x391c0cb3, 0xc5c95a63),
  w64(0x4ed8aa4a, 0xe3418acb),
  w64(0x5b9cca4f, 0x7763e373),
  w64(0x682e6ff3, 0xd6b2b8a3),
  w64(0x748f82ee, 0x5defb2fc),
  w64(0x78a5636f, 0x43172f60),
  w64(0x84c87814, 0xa1f0ab72),
  w64(0x8cc70208, 0x1a6439ec),
  w64(0x90befffa, 0x23631e28),
  w64(0xa4506ceb, 0xde82bde9),
  w64(0xbef9a3f7, 0xb2c67915),
  w64(0xc67178f2, 0xe372532b),
  w64(0xca273ece, 0xea26619c),
  w64(0xd186b8c7, 0x21c0c207),
  w64(0xeada7dd6, 0xcde0eb1e),
  w64(0xf57d4f7f, 0xee6ed178),
  w64(0x06f067aa, 0x72176fba),
  w64(0x0a637dc5, 0xa2c898a6),
  w64(0x113f9804, 0xbef90dae),
  w64(0x1b710b35, 0x131c471b),
  w64(0x28db77f5, 0x23047d84),
  w64(0x32caab7b, 0x40c72493),
  w64(0x3c9ebe0a, 0x15c9bebc),
  w64(0x431d67c4, 0x9c100d4c),
  w64(0x4cc5d4be, 0xcb3e42b6),
  w64(0x597f299c, 0xfc657e2a),
  w64(0x5fcb6fab, 0x3ad6faec),
  w64(0x6c44198c, 0x4a475817),
]

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

/** The big-endian 64-bit word at `buf[off]`. */
const loadWord = (buf: u8[], off: i32): u64 => {
  let word: u64 = 0
  for (let i: i32 = 0; i < 8; i++) {
    word = (word << 8) | toU64(buf[off + i])
  }
  return word
}

/** Writes `word` big-endian into `buf[off]` .. `buf[off + 7]`. */
const storeWord = (buf: u8[], off: i32, word: u64): void => {
  for (let i: i32 = 0; i < 8; i++) {
    buf[off + i] = toU8(word >> toU64((7 - i) * 8))
  }
}

/**
 * The state both hashes share: the hash value, the partial block, and the
 * message length in bytes as a 128-bit count (`countHi`, `countLo`), which is
 * what §5.1.2 appends once it is shifted into bits.
 */
class Sha512Engine {
  state: u64[]
  block: u8[]
  /** The message schedule W_0 .. W_79, kept so a block allocates nothing. */
  schedule: u64[]
  /** Shared, never written: a copy points at the same table. */
  constants: u64[]
  countLo: u64 = 0
  countHi: u64 = 0
  filled: i32 = 0
  finished: boolean = false

  constructor(initial: u64[], constants: u64[]) {
    this.state = initial
    this.block = new Array<u8>(SHA512_BLOCK)
    this.schedule = new Array<u64>(80)
    this.constants = constants
  }

  /** One application of §6.4.2 to the block at `src[off]` .. `src[off + 127]`. */
  compress(src: u8[], off: i32): void {
    const w = this.schedule
    const k = this.constants
    const h = this.state
    const wLen: i32 = toI32(w.length)
    const kLen: i32 = toI32(k.length)
    for (let t: i32 = 0; t < 16 && t < wLen; t++) {
      w[t] = loadWord(src, off + 8 * t)
    }
    for (let t: i32 = 16; t < wLen; t++) {
      w[t] = smallSigma1(w[t - 2]) + w[t - 7] + smallSigma0(w[t - 15]) + w[t - 16]
    }
    let a = h[0]
    let b = h[1]
    let c = h[2]
    let d = h[3]
    let e = h[4]
    let f = h[5]
    let g = h[6]
    let hh = h[7]
    for (let t: i32 = 0; t < wLen && t < kLen; t++) {
      const ch = (e & f) ^ (~e & g)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t1 = hh + bigSigma1(e) + ch + k[t] + w[t]
      const t2 = bigSigma0(a) + maj
      hh = g
      g = f
      f = e
      e = d + t1
      d = c
      c = b
      b = a
      a = t1 + t2
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

  absorb(data: u8[], off: i32, len: i32): void {
    if (this.finished) {
      panic("sha512: update after digest")
    }
    if (off < 0 || len < 0 || off > toI32(data.length) - len) {
      panic("sha512: the window is outside the buffer")
    }
    const added = toU64(len)
    this.countLo = this.countLo + added
    if (this.countLo < added) {
      this.countHi = this.countHi + 1
    }
    let at = off
    let left = len
    if (this.filled > 0) {
      const room: i32 = SHA512_BLOCK - this.filled
      const take: i32 = left < room ? left : room
      for (let i: i32 = 0; i < take; i++) {
        this.block[this.filled + i] = data[at + i]
      }
      this.filled = this.filled + take
      at = at + take
      left = left - take
      if (this.filled < SHA512_BLOCK) {
        return
      }
      this.compress(this.block, BLOCK_START)
      this.filled = 0
    }
    while (left >= SHA512_BLOCK) {
      this.compress(data, at)
      at = at + SHA512_BLOCK
      left = left - SHA512_BLOCK
    }
    for (let i: i32 = 0; i < left; i++) {
      this.block[i] = data[at + i]
    }
    this.filled = left
  }

  /**
   * Makes `twin` this engine at the same point. `twin` is a fresh engine of the
   * same hash, so its arrays are reused rather than allocated a second time.
   */
  copyInto(twin: Sha512Engine): void {
    for (let i: i32 = 0; i < 8; i++) {
      twin.state[i] = this.state[i]
    }
    for (let i: i32 = 0; i < this.filled; i++) {
      twin.block[i] = this.block[i]
    }
    twin.filled = this.filled
    twin.countLo = this.countLo
    twin.countHi = this.countHi
    twin.finished = this.finished
  }

  /** Pads (§5.1.2), compresses what is left, and answers the first `size` bytes of H(N) (§6.4.2, §6.5). */
  finish(size: i32): u8[] {
    if (this.finished) {
      panic("sha512: digest taken twice")
    }
    this.finished = true
    const block = this.block
    const blockLen: i32 = toI32(block.length)
    block[this.filled] = 0x80
    for (let i: i32 = this.filled + 1; i >= 0 && i < blockLen; i++) {
      block[i] = 0
    }
    if (this.filled >= LENGTH_AT) {
      this.compress(block, BLOCK_START)
      for (let i: i32 = 0; i < LENGTH_AT && i < blockLen; i++) {
        block[i] = 0
      }
    }
    storeWord(block, LENGTH_AT, (this.countHi << 3) | (this.countLo >> 61))
    storeWord(block, LENGTH_AT + 8, this.countLo << 3)
    this.compress(block, BLOCK_START)
    const whole = new Array<u8>(SHA512_SIZE)
    for (let i: i32 = 0; i < 8; i++) {
      storeWord(whole, 8 * i, this.state[i])
    }
    const out = new Array<u8>(size)
    const outLen: i32 = toI32(out.length)
    const wholeLen: i32 = toI32(whole.length)
    for (let i: i32 = 0; i < outLen && i < wholeLen; i++) {
      out[i] = whole[i]
    }
    return out
  }
}

/**
 * A streaming SHA-512 hasher. `update` takes a window `(data, off, len)`;
 * `digest` answers a fresh 64-byte array, after which the hasher is spent and
 * another `update` or `digest` panics.
 */
export class Sha512 {
  engine: Sha512Engine

  constructor() {
    this.engine = new Sha512Engine(sha512Initial(), roundConstants())
  }

  update(data: u8[], off: i32, len: i32): void {
    this.engine.absorb(data, off, len)
  }

  /** An independent hasher at the same point: updating either leaves the other alone. */
  copy(): Sha512 {
    const twin = new Sha512()
    this.engine.copyInto(twin.engine)
    return twin
  }

  digest(): u8[] {
    return this.engine.finish(SHA512_SIZE)
  }
}

/**
 * A streaming SHA-384 hasher, with `Sha512`'s methods. `digest` answers a
 * fresh 48-byte array.
 */
export class Sha384 {
  engine: Sha512Engine

  constructor() {
    this.engine = new Sha512Engine(sha384Initial(), roundConstants())
  }

  update(data: u8[], off: i32, len: i32): void {
    this.engine.absorb(data, off, len)
  }

  /** An independent hasher at the same point: updating either leaves the other alone. */
  copy(): Sha384 {
    const twin = new Sha384()
    this.engine.copyInto(twin.engine)
    return twin
  }

  digest(): u8[] {
    return this.engine.finish(SHA384_SIZE)
  }
}

/** The SHA-512 digest of all of `data`, as a fresh 64-byte array. */
export const sha512 = (data: u8[]): u8[] => {
  const hasher = new Sha512()
  hasher.update(data, BLOCK_START, toI32(data.length))
  return hasher.digest()
}

/** The SHA-384 digest of all of `data`, as a fresh 48-byte array. */
export const sha384 = (data: u8[]): u8[] => {
  const hasher = new Sha384()
  hasher.update(data, BLOCK_START, toI32(data.length))
  return hasher.digest()
}

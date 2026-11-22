/**
 * `nish/crypto/sha1` — SHA-1 as FIPS 180-4 §6.1 defines it, in pure Nish.
 *
 * **This is not for security.** SHA-1 is broken for collisions (SHAttered,
 * 2017) and no new protocol should sign or authenticate with it. It is here
 * for one caller: RFC 6455 §4.2.2's `Sec-WebSocket-Accept`, which is the
 * base64 of the SHA-1 of the client's key and a fixed GUID. That value proves
 * only that the server read the handshake as a WebSocket handshake, not who
 * either side is, so a collision buys an attacker nothing there.
 * `nish/net/websocket` is the importer; anything that needs a hash for its own
 * sake takes `nish/crypto/sha256`.
 *
 *     import { sha1 } from "nish/crypto/sha1";
 *
 *     const digest: u8[] = sha1(message); // 20 bytes
 *
 * One shot only, because a handshake key is a few dozen bytes: there is no
 * streaming hasher to keep in step with `Sha256`'s. A caller that hashes again
 * and again keeps a `Sha1` and calls `digestInto`, which writes into its
 * buffer and allocates nothing.
 *
 * Every word is a `u32`, whose arithmetic wraps, so the additions modulo 2^32
 * are plain `+`. The only branches are on lengths, loop counters and the round
 * number.
 *
 * Written from the specification, not ported from another implementation.
 */

/** The length of a digest in bytes (FIPS 180-4 §1). */
export const SHA1_SIZE: i32 = 20

/** The length of a message block in bytes (FIPS 180-4 §1). */
export const SHA1_BLOCK: i32 = 64

/** ROTL^n(x) of FIPS 180-4 §3.2: a left rotation of a 32-bit word, `0 < n < 32`. */
const sha1Rotl = (x: u32, n: u32): u32 => (x << n) | (x >>> (32 - n))

/**
 * Folds the 64-byte block at `src[at .. at + 64)` into `h`: FIPS 180-4
 * §6.1.2, steps 1 to 4. `w` is the 80-word schedule, held by the `Sha1`
 * hasher rather than allocated once per block. Every caller passes a block
 * inside `src` and the hasher's own `h` and `w`; the conditions below are the
 * shapes that prove each index in range, not checks a caller can fail.
 */
const sha1Compress = (h: u32[], w: u32[], src: u8[], at: i32): void => {
  if (toI32(h.length) >= 5 && toI32(w.length) >= 80) {
    // Step 1: the message schedule, big-endian words (§3.1), then (6.1.2).
    const n: i32 = toI32(src.length)
    let p: i32 = at
    for (let t: i32 = 0; t < 16 && p >= 0 && p < n - 3; t += 1) {
      w[t] = (toU32(src[p]) << 24) | (toU32(src[p + 1]) << 16) | (toU32(src[p + 2]) << 8) | toU32(src[p + 3])
      p += 4
    }
    for (let t: i32 = 16; t < 80; t += 1) {
      w[t] = sha1Rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1)
    }
    // Step 2.
    let a: u32 = h[0]
    let b: u32 = h[1]
    let c: u32 = h[2]
    let d: u32 = h[3]
    let e: u32 = h[4]
    // Step 3: eighty rounds, f_t and K_t of §4.1.1 and §4.2.1 by quarter.
    for (let t: i32 = 0; t < 80; t += 1) {
      let f: u32 = 0
      let k: u32 = 0
      if (t < 20) {
        f = (b & c) ^ (~b & d)
        k = 0x5a827999
      } else if (t < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (t < 60) {
        f = (b & c) ^ (b & d) ^ (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }
      const temp: u32 = sha1Rotl(a, 5) + f + e + k + w[t]
      e = d
      d = c
      c = sha1Rotl(b, 30)
      b = a
      a = temp
    }
    // Step 4.
    h[0] += a
    h[1] += b
    h[2] += c
    h[3] += d
    h[4] += e
  }
}

/** Sets `h` to H^(0) of FIPS 180-4 §5.3.1. */
const sha1Begin = (h: u32[]): void => {
  if (toI32(h.length) >= 5) {
    h[0] = 0x67452301
    h[1] = 0xefcdab89
    h[2] = 0x98badcfe
    h[3] = 0x10325476
    h[4] = 0xc3d2e1f0
  }
}

/**
 * Finishes a digest whose last `tail` bytes (`0 <= tail < 64`) the caller has
 * copied to `last[0 .. tail)`: pads them (FIPS 180-4 §5.1.1) with the message
 * length of `bits` bits, folds the one or two padded blocks into `h`, and
 * writes the digest to `out[at .. at + 20)`, which the caller has checked.
 */
const sha1Finish = (h: u32[], w: u32[], last: u8[], tail: i32, bits: u64, out: u8[], at: i32): void => {
  let lastLength: i32 = 64
  if (tail >= 56) {
    lastLength = 128
  }
  const room: i32 = toI32(last.length)
  // The 0x80 that ends the message, then zeros, then the length big-endian.
  let z: i32 = tail
  while (z >= 0 && z < lastLength && z < room) {
    last[z] = z === tail ? 0x80 : 0
    z += 1
  }
  let k: i32 = lastLength - 8
  let shift: u64 = 56
  for (let i: i32 = 0; i < 8 && k >= 0 && k < room; i += 1) {
    last[k] = toU8(bits >>> shift)
    shift -= 8
    k += 1
  }
  for (let off: i32 = 0; off < lastLength; off += 64) {
    sha1Compress(h, w, last, off)
  }
  let p: i32 = at
  for (let i: i32 = 0; i < 5 && i < toI32(h.length) && p >= 0 && p < toI32(out.length) - 3; i += 1) {
    const word: u32 = h[i]
    out[p] = toU8(word >>> 24)
    out[p + 1] = toU8(word >>> 16)
    out[p + 2] = toU8(word >>> 8)
    out[p + 3] = toU8(word)
    p += 4
  }
}

/**
 * A SHA-1 hasher that keeps its working state, so that a caller hashing again
 * and again (a server answering WebSocket handshakes) allocates once, when it
 * builds one, and never after: `digestInto` writes into the caller's buffer.
 * It holds no secret, so nothing in it is wiped.
 *
 *     const hasher = new Sha1();
 *     hasher.digestInto(message, 0, message.length, digest, 0); // digest[0 .. 20)
 */
export class Sha1 {
  /** The chaining value H of FIPS 180-4 §6.1.2, five words. */
  h: u32[]
  /** The 80-word message schedule, reused for every block. */
  w: u32[]
  /** The last one or two blocks: the message's tail and its padding (§5.1.1). */
  last: u8[]

  /** A hasher with its buffers allocated, ready for `digestInto`. */
  constructor() {
    this.h = new Array<u32>(5)
    this.w = new Array<u32>(80)
    this.last = new Array<u8>(128)
  }

  /**
   * Writes the SHA-1 digest of `data[start .. start + length)` into
   * `out[at .. at + 20)`, allocating nothing. A range outside `data` or `out`
   * writes nothing and answers `false`.
   *
   * @param data The buffer holding the message; it is read, not changed.
   * @param start Where in `data` the message starts.
   * @param length How many bytes of `data` the message is.
   * @param out The buffer the 20-byte digest is written into.
   * @param at Where in `out` the digest starts.
   * @returns `true` once the digest is written; `false`, with `out` untouched, when either range lies outside its buffer.
   */
  digestInto(data: u8[], start: i32, length: i32, out: u8[], at: i32): boolean {
    // `toI32` of a length past 2^31 - 1 (under `--number-mode f64`) saturates,
    // which only narrows the ranges accepted here: an `i32` range ends below it.
    if (start < 0 || length < 0 || start > toI32(data.length) - length) {
      return false
    }
    if (at < 0 || at > toI32(out.length) - SHA1_SIZE) {
      return false
    }
    const h: u32[] = this.h
    const w: u32[] = this.w
    const last: u8[] = this.last
    sha1Begin(h)
    // Whole blocks straight from `data`, then the tail and its padding (§5.1.1)
    // in one or two blocks of `last`.
    const size: i32 = toI32(data.length)
    let off: i32 = start
    let left: i32 = length
    while (left >= 64 && off >= 0 && off <= size - 64) {
      sha1Compress(h, w, data, off)
      off += 64
      left -= 64
    }
    let k: i32 = 0
    const room: i32 = toI32(last.length)
    while (k < left && k < room && off >= 0 && off < size) {
      last[k] = data[off]
      k += 1
      off += 1
    }
    sha1Finish(h, w, last, k, toU64(toI64(length)) << 3, out, at)
    return true
  }
}

/**
 * The SHA-1 digest of all of `data`, as a fresh 20-byte array.
 *
 * It walks `data` with a `number` offset and copies each block into the
 * hasher's own buffer, so an array longer than 2^31 - 1 bytes (possible under
 * `--number-mode f64`) is hashed whole, never cut to a prefix.
 *
 * @param data The whole message; it is read, not changed.
 * @returns A fresh 20-byte digest.
 */
export const sha1 = (data: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(SHA1_SIZE)
  const hasher: Sha1 = new Sha1()
  const h: u32[] = hasher.h
  const w: u32[] = hasher.w
  const last: u8[] = hasher.last
  const room: i32 = toI32(last.length)
  sha1Begin(h)
  const n: number = data.length
  let off: number = 0
  while (true) {
    let k: i32 = 0
    while (k < SHA1_BLOCK && k < room && off >= 0 && off < n) {
      last[k] = data[off]
      k += 1
      off += 1
    }
    if (k < SHA1_BLOCK) {
      sha1Finish(h, w, last, k, toU64(toI64(n)) << 3, out, 0)
      return out
    }
    sha1Compress(h, w, last, 0)
  }
}

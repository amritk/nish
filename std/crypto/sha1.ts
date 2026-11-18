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

/** The big-endian word at `buf[at .. at + 4)`, as FIPS 180-4 §3.1 orders bytes in a word. */
const sha1LoadWord = (buf: u8[], at: i32): u32 =>
  (toU32(buf[at]) << 24) | (toU32(buf[at + 1]) << 16) | (toU32(buf[at + 2]) << 8) | toU32(buf[at + 3])

/**
 * Folds the 64-byte block at `src[at .. at + 64)` into `h`: FIPS 180-4
 * §6.1.2, steps 1 to 4. `w` is the 80-word schedule, held by the `Sha1`
 * hasher rather than allocated once per block.
 */
const sha1Compress = (h: u32[], w: u32[], src: u8[], at: i32): void => {
  // Written as the condition the body runs under, the shape that proves the
  // plain `w[t]` and `h[i]` indices in range (as `sha256Compress` does).
  if (toI32(h.length) >= 5 && toI32(w.length) >= 80 && at >= 0 && at <= toI32(src.length) - SHA1_BLOCK) {
    // Step 1: the message schedule, big-endian words (§3.1), then (6.1.2).
    for (let t: i32 = 0; t < 16; t += 1) {
      w[t] = sha1LoadWord(src, at + 4 * t)
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
  } else {
    panic("sha1: a block outside its buffer")
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
    this.last = new Array<u8>(2 * SHA1_BLOCK)
  }

  /**
   * Writes the SHA-1 digest of `data[start .. start + length)` into
   * `out[at .. at + 20)`, allocating nothing. A range outside `data` or `out`
   * panics, as does a message longer than 2^31 - 1 bytes.
   *
   * @param data The buffer holding the message; it is read, not changed.
   * @param start Where in `data` the message starts.
   * @param length How many bytes of `data` the message is.
   * @param out The buffer the 20-byte digest is written into.
   * @param at Where in `out` the digest starts.
   */
  digestInto(data: u8[], start: i32, length: i32, out: u8[], at: i32): void {
    if (data.length > 2147483647 || out.length > 2147483647) {
      panic("sha1: a buffer longer than 2^31 - 1 bytes")
    }
    if (start < 0 || length < 0 || start > toI32(data.length) - length) {
      panic("sha1: a message outside its buffer")
    }
    if (at < 0 || at > toI32(out.length) - SHA1_SIZE) {
      panic("sha1: a digest outside its buffer")
    }
    const h: u32[] = this.h
    const w: u32[] = this.w
    const last: u8[] = this.last
    if (toI32(h.length) < 5) {
      panic("sha1: a hasher without its state")
    }
    // H^(0) of FIPS 180-4 §5.3.1.
    h[0] = 0x67452301
    h[1] = 0xefcdab89
    h[2] = 0x98badcfe
    h[3] = 0x10325476
    h[4] = 0xc3d2e1f0
    // Whole blocks straight from `data`, then the tail and its padding (§5.1.1)
    // in one or two blocks of `last`.
    const whole: i32 = length - (length % SHA1_BLOCK)
    for (let off: i32 = 0; off < whole; off += SHA1_BLOCK) {
      sha1Compress(h, w, data, start + off)
    }
    const tail: i32 = length - whole
    const lastLength: i32 = tail < SHA1_BLOCK - 8 ? SHA1_BLOCK : 2 * SHA1_BLOCK
    const room: i32 = toI32(last.length)
    if (lastLength > room) {
      panic("sha1: a hasher without its state")
    }
    for (let k: i32 = 0; k < lastLength && k < room; k += 1) {
      last[k] = k < tail ? data[start + whole + k] : 0
    }
    last[tail] = 0x80
    const bits: u64 = toU64(toI64(length)) << 3
    for (let i: i32 = 0; i < 8; i += 1) {
      last[lastLength - 1 - i] = toU8(bits >>> toU64(8 * i))
    }
    for (let off: i32 = 0; off < lastLength; off += SHA1_BLOCK) {
      sha1Compress(h, w, last, off)
    }
    for (let i: i32 = 0; i < 5; i += 1) {
      const word: u32 = h[i]
      out[at + 4 * i] = toU8(word >>> 24)
      out[at + 4 * i + 1] = toU8(word >>> 16)
      out[at + 4 * i + 2] = toU8(word >>> 8)
      out[at + 4 * i + 3] = toU8(word)
    }
  }
}

/**
 * The SHA-1 digest of all of `data`, as a fresh 20-byte array: `Sha1`'s
 * `digestInto` over the whole of it, with a hasher of its own.
 *
 * An array longer than 2^31 - 1 bytes panics, for the reason `sha256` gives:
 * under `--number-mode f64`, `toI32` of a longer length saturates, and the
 * answer would be the digest of a prefix.
 *
 * @param data The whole message; it is read, not changed.
 * @returns A fresh 20-byte digest.
 */
export const sha1 = (data: u8[]): u8[] => {
  if (data.length > 2147483647) {
    panic("sha1: a message longer than 2^31 - 1 bytes")
  }
  const out: u8[] = new Array<u8>(SHA1_SIZE)
  const zero: i32 = 0
  new Sha1().digestInto(data, zero, toI32(data.length), out, zero)
  return out
}

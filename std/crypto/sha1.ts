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
 * streaming hasher to keep in step with `Sha256`'s.
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
 * §6.1.2, steps 1 to 4. `w` is the 80-word schedule, allocated once per call
 * to `sha1` rather than once per block.
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
 * The SHA-1 digest of all of `data`, as a fresh 20-byte array.
 *
 * An array longer than 2^31 - 1 bytes panics, for the reason `sha256` gives:
 * under `--number-mode f64`, `toI32` of a longer length saturates, and the
 * answer would be the digest of a prefix.
 */
export const sha1 = (data: u8[]): u8[] => {
  if (data.length > 2147483647) {
    panic("sha1: a message longer than 2^31 - 1 bytes")
  }
  const n: i32 = toI32(data.length)
  // H^(0) of FIPS 180-4 §5.3.1.
  const h: u32[] = new Array<u32>(5)
  h[0] = 0x67452301
  h[1] = 0xefcdab89
  h[2] = 0x98badcfe
  h[3] = 0x10325476
  h[4] = 0xc3d2e1f0
  const w: u32[] = new Array<u32>(80)
  // Whole blocks straight from `data`, then the tail and its padding (§5.1.1)
  // in one or two blocks of their own.
  const whole: i32 = n - (n % SHA1_BLOCK)
  for (let at: i32 = 0; at < whole; at += SHA1_BLOCK) {
    sha1Compress(h, w, data, at)
  }
  const tail: i32 = n - whole
  const tailBlocks: i32 = tail < SHA1_BLOCK - 8 ? 1 : 2
  const last: u8[] = new Array<u8>(tailBlocks * SHA1_BLOCK)
  const lastLength: i32 = toI32(last.length)
  for (let k: i32 = 0; k < tail && k < lastLength; k += 1) {
    last[k] = data[whole + k]
  }
  last[tail] = 0x80
  const bits: u64 = toU64(toI64(n)) << 3
  for (let i: i32 = 0; i < 8; i += 1) {
    last[lastLength - 1 - i] = toU8(bits >>> toU64(8 * i))
  }
  for (let at: i32 = 0; at < lastLength; at += SHA1_BLOCK) {
    sha1Compress(h, w, last, at)
  }
  const out: u8[] = new Array<u8>(SHA1_SIZE)
  for (let i: i32 = 0; i < 5; i += 1) {
    const word: u32 = h[i]
    out[4 * i] = toU8(word >>> 24)
    out[4 * i + 1] = toU8(word >>> 16)
    out[4 * i + 2] = toU8(word >>> 8)
    out[4 * i + 3] = toU8(word)
  }
  return out
}

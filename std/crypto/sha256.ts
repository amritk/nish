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
 * Every read is checked: nothing here imports `nish:unsafe`, so hashing never
 * makes a caller reach `unsafe`, which `--deny unsafe` refuses (the SCRAM in
 * `std/net/postgres.ts` is one such caller). `sha256Compress` instead orders
 * its reads so that the optimiser can fold a block's bounds checks into one.
 *
 * Written from the specification, not ported from another implementation.
 */

/** The length of a digest in bytes (FIPS 180-4 §1, "Message Digest Size"). */
export const SHA256_SIZE: i32 = 32

/** The length of a message block in bytes (FIPS 180-4 §1, "Block Size"). */
export const SHA256_BLOCK: i32 = 64

/** ROTR^n(x) of FIPS 180-4 §3.2: a right rotation of a 32-bit word, `0 < n < 32`. */
const sha256Rotr = (x: u32, n: u32): u32 => (x >>> n) | (x << (32 - n))

/** Σ0 of FIPS 180-4 §4.1.2, (4.4). */
const sha256BigSigma0 = (x: u32): u32 => sha256Rotr(x, 2) ^ sha256Rotr(x, 13) ^ sha256Rotr(x, 22)

/** Σ1 of FIPS 180-4 §4.1.2, (4.5). */
const sha256BigSigma1 = (x: u32): u32 => sha256Rotr(x, 6) ^ sha256Rotr(x, 11) ^ sha256Rotr(x, 25)

/** σ0 of FIPS 180-4 §4.1.2, (4.6). */
const sha256SmallSigma0 = (x: u32): u32 => sha256Rotr(x, 7) ^ sha256Rotr(x, 18) ^ (x >>> 3)

/** σ1 of FIPS 180-4 §4.1.2, (4.7). */
const sha256SmallSigma1 = (x: u32): u32 => sha256Rotr(x, 17) ^ sha256Rotr(x, 19) ^ (x >>> 10)

/**
 * Ch of FIPS 180-4 §4.1.2, (4.2). `(x & y) ^ (~x & z)` picks each bit of `y`
 * where `x` has a one and of `z` where it has a zero, which is what
 * `z ^ (x & (y ^ z))` computes in three operations instead of four.
 */
const sha256Choose = (x: u32, y: u32, z: u32): u32 => z ^ (x & (y ^ z))

/**
 * Maj of FIPS 180-4 §4.1.2, (4.3). `(x & y) ^ (x & z) ^ (y & z)` is each
 * bit's majority vote, which is `x & y` unless `x` and `y` differ, and then
 * `z`'s bit: `(x & y) ^ (z & (x ^ y))`.
 */
const sha256Majority = (x: u32, y: u32, z: u32): u32 => (x & y) ^ (z & (x ^ y))

/**
 * The big-endian word at `buf[p .. p + 4)`, as FIPS 180-4 §3.1 orders bytes in
 * a word. `p`'s range makes each `p + k` an `add nsw`, with no overflow test.
 * The low byte, `buf[p + 3]`, is read first, so its bounds check also covers
 * the three reads after it and LLVM drops theirs; once a check further on in
 * the buffer covers that one too, nothing lies between the four reads and
 * LLVM joins them into one 32-bit load and a byte swap.
 *
 * The low byte is also the innermost `|` because σ1 shifts a word right by 10,
 * and when the low byte is the outermost operand LLVM's instcombine answers
 * that shift from the inner three bytes alone, which gives the half-built word
 * a second use and leaves words 14 and 15 as four byte loads each.
 */
const sha256LoadWord = (buf: u8[], p: integer<0, 2147483643>): u32 =>
  toU32(buf[p + 3]) | (toU32(buf[p + 2]) << 8) | (toU32(buf[p + 1]) << 16) | (toU32(buf[p]) << 24)

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
 * plain local whose length the guard below proves once for every access.
 *
 * The sixty-four rounds are written out rather than looped. Unrolled, each
 * round constant K_t of §4.2.2 (the first 32 bits of the fractional parts of
 * the cube roots of the first sixty-four primes) is an immediate operand, and
 * the eight working variables never move: instead of `h = g`, `g = f` and so
 * on, each round renames them, so round t + 1 reads as its `a` the variable
 * round t wrote as its `h`, and after eight rounds the names are back where
 * they started. Only `d` and `h` of a round are written: `d + T1` is the next
 * `e`, and `T1 + T2` the next `a`. The message schedule of step 1 is computed
 * one word ahead of the round that reads it, rather than all at once first.
 */
const sha256Compress = (h: u32[], w: u32[], src: u8[], at: i32): void => {
  // The test is written as the condition the body runs under, not as an early
  // exit, because that is the shape that proves the constant `w[t]` and `h[i]`
  // indices in range and drops their bounds checks. Its last clause, which
  // the one before implies for any array an `i32` can index, is what puts
  // `at` in `base`'s range with no check.
  if (
    toI32(h.length) >= 8 &&
    toI32(w.length) >= 64 &&
    at >= 0 &&
    at <= toI32(src.length) - SHA256_BLOCK &&
    at <= 2147483583
  ) {
    const base: integer<0, 2147483583> = at
    // Word 15 is loaded first. Its first read, the block's last byte, is the
    // one bounds check of the block: the checker cannot prove `base + k` in
    // range from the guard, but LLVM sees that every other read of the block
    // lies below it and drops their checks, so words 0 to 14 are each one
    // load and a byte swap. Word 15 stays four byte loads, because its last
    // byte's index is the check's.
    w[15] = sha256LoadWord(src, base + 60)
    // Step 2: the working variables start from the previous hash value.
    let a: u32 = h[0]
    let b: u32 = h[1]
    let c: u32 = h[2]
    let d: u32 = h[3]
    let e: u32 = h[4]
    let f: u32 = h[5]
    let g: u32 = h[6]
    let hh: u32 = h[7]
    // T1 of step 3; T2 is added where it is computed.
    let t1: u32 = 0
    // Steps 1 and 3: rounds 0 to 15 read the block's sixteen words.
    w[0] = sha256LoadWord(src, base)
    t1 = hh + sha256BigSigma1(e) + sha256Choose(e, f, g) + 0x428a2f98 + w[0]
    d += t1
    hh = t1 + sha256BigSigma0(a) + sha256Majority(a, b, c)
    w[1] = sha256LoadWord(src, base + 4)
    t1 = g + sha256BigSigma1(d) + sha256Choose(d, e, f) + 0x71374491 + w[1]
    c += t1
    g = t1 + sha256BigSigma0(hh) + sha256Majority(hh, a, b)
    w[2] = sha256LoadWord(src, base + 8)
    t1 = f + sha256BigSigma1(c) + sha256Choose(c, d, e) + 0xb5c0fbcf + w[2]
    b += t1
    f = t1 + sha256BigSigma0(g) + sha256Majority(g, hh, a)
    w[3] = sha256LoadWord(src, base + 12)
    t1 = e + sha256BigSigma1(b) + sha256Choose(b, c, d) + 0xe9b5dba5 + w[3]
    a += t1
    e = t1 + sha256BigSigma0(f) + sha256Majority(f, g, hh)
    w[4] = sha256LoadWord(src, base + 16)
    t1 = d + sha256BigSigma1(a) + sha256Choose(a, b, c) + 0x3956c25b + w[4]
    hh += t1
    d = t1 + sha256BigSigma0(e) + sha256Majority(e, f, g)
    w[5] = sha256LoadWord(src, base + 20)
    t1 = c + sha256BigSigma1(hh) + sha256Choose(hh, a, b) + 0x59f111f1 + w[5]
    g += t1
    c = t1 + sha256BigSigma0(d) + sha256Majority(d, e, f)
    w[6] = sha256LoadWord(src, base + 24)
    t1 = b + sha256BigSigma1(g) + sha256Choose(g, hh, a) + 0x923f82a4 + w[6]
    f += t1
    b = t1 + sha256BigSigma0(c) + sha256Majority(c, d, e)
    w[7] = sha256LoadWord(src, base + 28)
    t1 = a + sha256BigSigma1(f) + sha256Choose(f, g, hh) + 0xab1c5ed5 + w[7]
    e += t1
    a = t1 + sha256BigSigma0(b) + sha256Majority(b, c, d)
    w[8] = sha256LoadWord(src, base + 32)
    t1 = hh + sha256BigSigma1(e) + sha256Choose(e, f, g) + 0xd807aa98 + w[8]
    d += t1
    hh = t1 + sha256BigSigma0(a) + sha256Majority(a, b, c)
    w[9] = sha256LoadWord(src, base + 36)
    t1 = g + sha256BigSigma1(d) + sha256Choose(d, e, f) + 0x12835b01 + w[9]
    c += t1
    g = t1 + sha256BigSigma0(hh) + sha256Majority(hh, a, b)
    w[10] = sha256LoadWord(src, base + 40)
    t1 = f + sha256BigSigma1(c) + sha256Choose(c, d, e) + 0x243185be + w[10]
    b += t1
    f = t1 + sha256BigSigma0(g) + sha256Majority(g, hh, a)
    w[11] = sha256LoadWord(src, base + 44)
    t1 = e + sha256BigSigma1(b) + sha256Choose(b, c, d) + 0x550c7dc3 + w[11]
    a += t1
    e = t1 + sha256BigSigma0(f) + sha256Majority(f, g, hh)
    w[12] = sha256LoadWord(src, base + 48)
    t1 = d + sha256BigSigma1(a) + sha256Choose(a, b, c) + 0x72be5d74 + w[12]
    hh += t1
    d = t1 + sha256BigSigma0(e) + sha256Majority(e, f, g)
    w[13] = sha256LoadWord(src, base + 52)
    t1 = c + sha256BigSigma1(hh) + sha256Choose(hh, a, b) + 0x80deb1fe + w[13]
    g += t1
    c = t1 + sha256BigSigma0(d) + sha256Majority(d, e, f)
    w[14] = sha256LoadWord(src, base + 56)
    t1 = b + sha256BigSigma1(g) + sha256Choose(g, hh, a) + 0x9bdc06a7 + w[14]
    f += t1
    b = t1 + sha256BigSigma0(c) + sha256Majority(c, d, e)
    t1 = a + sha256BigSigma1(f) + sha256Choose(f, g, hh) + 0xc19bf174 + w[15]
    e += t1
    a = t1 + sha256BigSigma0(b) + sha256Majority(b, c, d)
    // Rounds 16 to 63 extend the schedule one word ahead of the round that reads it.
    w[16] = sha256SmallSigma1(w[14]) + w[9] + sha256SmallSigma0(w[1]) + w[0]
    t1 = hh + sha256BigSigma1(e) + sha256Choose(e, f, g) + 0xe49b69c1 + w[16]
    d += t1
    hh = t1 + sha256BigSigma0(a) + sha256Majority(a, b, c)
    w[17] = sha256SmallSigma1(w[15]) + w[10] + sha256SmallSigma0(w[2]) + w[1]
    t1 = g + sha256BigSigma1(d) + sha256Choose(d, e, f) + 0xefbe4786 + w[17]
    c += t1
    g = t1 + sha256BigSigma0(hh) + sha256Majority(hh, a, b)
    w[18] = sha256SmallSigma1(w[16]) + w[11] + sha256SmallSigma0(w[3]) + w[2]
    t1 = f + sha256BigSigma1(c) + sha256Choose(c, d, e) + 0x0fc19dc6 + w[18]
    b += t1
    f = t1 + sha256BigSigma0(g) + sha256Majority(g, hh, a)
    w[19] = sha256SmallSigma1(w[17]) + w[12] + sha256SmallSigma0(w[4]) + w[3]
    t1 = e + sha256BigSigma1(b) + sha256Choose(b, c, d) + 0x240ca1cc + w[19]
    a += t1
    e = t1 + sha256BigSigma0(f) + sha256Majority(f, g, hh)
    w[20] = sha256SmallSigma1(w[18]) + w[13] + sha256SmallSigma0(w[5]) + w[4]
    t1 = d + sha256BigSigma1(a) + sha256Choose(a, b, c) + 0x2de92c6f + w[20]
    hh += t1
    d = t1 + sha256BigSigma0(e) + sha256Majority(e, f, g)
    w[21] = sha256SmallSigma1(w[19]) + w[14] + sha256SmallSigma0(w[6]) + w[5]
    t1 = c + sha256BigSigma1(hh) + sha256Choose(hh, a, b) + 0x4a7484aa + w[21]
    g += t1
    c = t1 + sha256BigSigma0(d) + sha256Majority(d, e, f)
    w[22] = sha256SmallSigma1(w[20]) + w[15] + sha256SmallSigma0(w[7]) + w[6]
    t1 = b + sha256BigSigma1(g) + sha256Choose(g, hh, a) + 0x5cb0a9dc + w[22]
    f += t1
    b = t1 + sha256BigSigma0(c) + sha256Majority(c, d, e)
    w[23] = sha256SmallSigma1(w[21]) + w[16] + sha256SmallSigma0(w[8]) + w[7]
    t1 = a + sha256BigSigma1(f) + sha256Choose(f, g, hh) + 0x76f988da + w[23]
    e += t1
    a = t1 + sha256BigSigma0(b) + sha256Majority(b, c, d)
    w[24] = sha256SmallSigma1(w[22]) + w[17] + sha256SmallSigma0(w[9]) + w[8]
    t1 = hh + sha256BigSigma1(e) + sha256Choose(e, f, g) + 0x983e5152 + w[24]
    d += t1
    hh = t1 + sha256BigSigma0(a) + sha256Majority(a, b, c)
    w[25] = sha256SmallSigma1(w[23]) + w[18] + sha256SmallSigma0(w[10]) + w[9]
    t1 = g + sha256BigSigma1(d) + sha256Choose(d, e, f) + 0xa831c66d + w[25]
    c += t1
    g = t1 + sha256BigSigma0(hh) + sha256Majority(hh, a, b)
    w[26] = sha256SmallSigma1(w[24]) + w[19] + sha256SmallSigma0(w[11]) + w[10]
    t1 = f + sha256BigSigma1(c) + sha256Choose(c, d, e) + 0xb00327c8 + w[26]
    b += t1
    f = t1 + sha256BigSigma0(g) + sha256Majority(g, hh, a)
    w[27] = sha256SmallSigma1(w[25]) + w[20] + sha256SmallSigma0(w[12]) + w[11]
    t1 = e + sha256BigSigma1(b) + sha256Choose(b, c, d) + 0xbf597fc7 + w[27]
    a += t1
    e = t1 + sha256BigSigma0(f) + sha256Majority(f, g, hh)
    w[28] = sha256SmallSigma1(w[26]) + w[21] + sha256SmallSigma0(w[13]) + w[12]
    t1 = d + sha256BigSigma1(a) + sha256Choose(a, b, c) + 0xc6e00bf3 + w[28]
    hh += t1
    d = t1 + sha256BigSigma0(e) + sha256Majority(e, f, g)
    w[29] = sha256SmallSigma1(w[27]) + w[22] + sha256SmallSigma0(w[14]) + w[13]
    t1 = c + sha256BigSigma1(hh) + sha256Choose(hh, a, b) + 0xd5a79147 + w[29]
    g += t1
    c = t1 + sha256BigSigma0(d) + sha256Majority(d, e, f)
    w[30] = sha256SmallSigma1(w[28]) + w[23] + sha256SmallSigma0(w[15]) + w[14]
    t1 = b + sha256BigSigma1(g) + sha256Choose(g, hh, a) + 0x06ca6351 + w[30]
    f += t1
    b = t1 + sha256BigSigma0(c) + sha256Majority(c, d, e)
    w[31] = sha256SmallSigma1(w[29]) + w[24] + sha256SmallSigma0(w[16]) + w[15]
    t1 = a + sha256BigSigma1(f) + sha256Choose(f, g, hh) + 0x14292967 + w[31]
    e += t1
    a = t1 + sha256BigSigma0(b) + sha256Majority(b, c, d)
    w[32] = sha256SmallSigma1(w[30]) + w[25] + sha256SmallSigma0(w[17]) + w[16]
    t1 = hh + sha256BigSigma1(e) + sha256Choose(e, f, g) + 0x27b70a85 + w[32]
    d += t1
    hh = t1 + sha256BigSigma0(a) + sha256Majority(a, b, c)
    w[33] = sha256SmallSigma1(w[31]) + w[26] + sha256SmallSigma0(w[18]) + w[17]
    t1 = g + sha256BigSigma1(d) + sha256Choose(d, e, f) + 0x2e1b2138 + w[33]
    c += t1
    g = t1 + sha256BigSigma0(hh) + sha256Majority(hh, a, b)
    w[34] = sha256SmallSigma1(w[32]) + w[27] + sha256SmallSigma0(w[19]) + w[18]
    t1 = f + sha256BigSigma1(c) + sha256Choose(c, d, e) + 0x4d2c6dfc + w[34]
    b += t1
    f = t1 + sha256BigSigma0(g) + sha256Majority(g, hh, a)
    w[35] = sha256SmallSigma1(w[33]) + w[28] + sha256SmallSigma0(w[20]) + w[19]
    t1 = e + sha256BigSigma1(b) + sha256Choose(b, c, d) + 0x53380d13 + w[35]
    a += t1
    e = t1 + sha256BigSigma0(f) + sha256Majority(f, g, hh)
    w[36] = sha256SmallSigma1(w[34]) + w[29] + sha256SmallSigma0(w[21]) + w[20]
    t1 = d + sha256BigSigma1(a) + sha256Choose(a, b, c) + 0x650a7354 + w[36]
    hh += t1
    d = t1 + sha256BigSigma0(e) + sha256Majority(e, f, g)
    w[37] = sha256SmallSigma1(w[35]) + w[30] + sha256SmallSigma0(w[22]) + w[21]
    t1 = c + sha256BigSigma1(hh) + sha256Choose(hh, a, b) + 0x766a0abb + w[37]
    g += t1
    c = t1 + sha256BigSigma0(d) + sha256Majority(d, e, f)
    w[38] = sha256SmallSigma1(w[36]) + w[31] + sha256SmallSigma0(w[23]) + w[22]
    t1 = b + sha256BigSigma1(g) + sha256Choose(g, hh, a) + 0x81c2c92e + w[38]
    f += t1
    b = t1 + sha256BigSigma0(c) + sha256Majority(c, d, e)
    w[39] = sha256SmallSigma1(w[37]) + w[32] + sha256SmallSigma0(w[24]) + w[23]
    t1 = a + sha256BigSigma1(f) + sha256Choose(f, g, hh) + 0x92722c85 + w[39]
    e += t1
    a = t1 + sha256BigSigma0(b) + sha256Majority(b, c, d)
    w[40] = sha256SmallSigma1(w[38]) + w[33] + sha256SmallSigma0(w[25]) + w[24]
    t1 = hh + sha256BigSigma1(e) + sha256Choose(e, f, g) + 0xa2bfe8a1 + w[40]
    d += t1
    hh = t1 + sha256BigSigma0(a) + sha256Majority(a, b, c)
    w[41] = sha256SmallSigma1(w[39]) + w[34] + sha256SmallSigma0(w[26]) + w[25]
    t1 = g + sha256BigSigma1(d) + sha256Choose(d, e, f) + 0xa81a664b + w[41]
    c += t1
    g = t1 + sha256BigSigma0(hh) + sha256Majority(hh, a, b)
    w[42] = sha256SmallSigma1(w[40]) + w[35] + sha256SmallSigma0(w[27]) + w[26]
    t1 = f + sha256BigSigma1(c) + sha256Choose(c, d, e) + 0xc24b8b70 + w[42]
    b += t1
    f = t1 + sha256BigSigma0(g) + sha256Majority(g, hh, a)
    w[43] = sha256SmallSigma1(w[41]) + w[36] + sha256SmallSigma0(w[28]) + w[27]
    t1 = e + sha256BigSigma1(b) + sha256Choose(b, c, d) + 0xc76c51a3 + w[43]
    a += t1
    e = t1 + sha256BigSigma0(f) + sha256Majority(f, g, hh)
    w[44] = sha256SmallSigma1(w[42]) + w[37] + sha256SmallSigma0(w[29]) + w[28]
    t1 = d + sha256BigSigma1(a) + sha256Choose(a, b, c) + 0xd192e819 + w[44]
    hh += t1
    d = t1 + sha256BigSigma0(e) + sha256Majority(e, f, g)
    w[45] = sha256SmallSigma1(w[43]) + w[38] + sha256SmallSigma0(w[30]) + w[29]
    t1 = c + sha256BigSigma1(hh) + sha256Choose(hh, a, b) + 0xd6990624 + w[45]
    g += t1
    c = t1 + sha256BigSigma0(d) + sha256Majority(d, e, f)
    w[46] = sha256SmallSigma1(w[44]) + w[39] + sha256SmallSigma0(w[31]) + w[30]
    t1 = b + sha256BigSigma1(g) + sha256Choose(g, hh, a) + 0xf40e3585 + w[46]
    f += t1
    b = t1 + sha256BigSigma0(c) + sha256Majority(c, d, e)
    w[47] = sha256SmallSigma1(w[45]) + w[40] + sha256SmallSigma0(w[32]) + w[31]
    t1 = a + sha256BigSigma1(f) + sha256Choose(f, g, hh) + 0x106aa070 + w[47]
    e += t1
    a = t1 + sha256BigSigma0(b) + sha256Majority(b, c, d)
    w[48] = sha256SmallSigma1(w[46]) + w[41] + sha256SmallSigma0(w[33]) + w[32]
    t1 = hh + sha256BigSigma1(e) + sha256Choose(e, f, g) + 0x19a4c116 + w[48]
    d += t1
    hh = t1 + sha256BigSigma0(a) + sha256Majority(a, b, c)
    w[49] = sha256SmallSigma1(w[47]) + w[42] + sha256SmallSigma0(w[34]) + w[33]
    t1 = g + sha256BigSigma1(d) + sha256Choose(d, e, f) + 0x1e376c08 + w[49]
    c += t1
    g = t1 + sha256BigSigma0(hh) + sha256Majority(hh, a, b)
    w[50] = sha256SmallSigma1(w[48]) + w[43] + sha256SmallSigma0(w[35]) + w[34]
    t1 = f + sha256BigSigma1(c) + sha256Choose(c, d, e) + 0x2748774c + w[50]
    b += t1
    f = t1 + sha256BigSigma0(g) + sha256Majority(g, hh, a)
    w[51] = sha256SmallSigma1(w[49]) + w[44] + sha256SmallSigma0(w[36]) + w[35]
    t1 = e + sha256BigSigma1(b) + sha256Choose(b, c, d) + 0x34b0bcb5 + w[51]
    a += t1
    e = t1 + sha256BigSigma0(f) + sha256Majority(f, g, hh)
    w[52] = sha256SmallSigma1(w[50]) + w[45] + sha256SmallSigma0(w[37]) + w[36]
    t1 = d + sha256BigSigma1(a) + sha256Choose(a, b, c) + 0x391c0cb3 + w[52]
    hh += t1
    d = t1 + sha256BigSigma0(e) + sha256Majority(e, f, g)
    w[53] = sha256SmallSigma1(w[51]) + w[46] + sha256SmallSigma0(w[38]) + w[37]
    t1 = c + sha256BigSigma1(hh) + sha256Choose(hh, a, b) + 0x4ed8aa4a + w[53]
    g += t1
    c = t1 + sha256BigSigma0(d) + sha256Majority(d, e, f)
    w[54] = sha256SmallSigma1(w[52]) + w[47] + sha256SmallSigma0(w[39]) + w[38]
    t1 = b + sha256BigSigma1(g) + sha256Choose(g, hh, a) + 0x5b9cca4f + w[54]
    f += t1
    b = t1 + sha256BigSigma0(c) + sha256Majority(c, d, e)
    w[55] = sha256SmallSigma1(w[53]) + w[48] + sha256SmallSigma0(w[40]) + w[39]
    t1 = a + sha256BigSigma1(f) + sha256Choose(f, g, hh) + 0x682e6ff3 + w[55]
    e += t1
    a = t1 + sha256BigSigma0(b) + sha256Majority(b, c, d)
    w[56] = sha256SmallSigma1(w[54]) + w[49] + sha256SmallSigma0(w[41]) + w[40]
    t1 = hh + sha256BigSigma1(e) + sha256Choose(e, f, g) + 0x748f82ee + w[56]
    d += t1
    hh = t1 + sha256BigSigma0(a) + sha256Majority(a, b, c)
    w[57] = sha256SmallSigma1(w[55]) + w[50] + sha256SmallSigma0(w[42]) + w[41]
    t1 = g + sha256BigSigma1(d) + sha256Choose(d, e, f) + 0x78a5636f + w[57]
    c += t1
    g = t1 + sha256BigSigma0(hh) + sha256Majority(hh, a, b)
    w[58] = sha256SmallSigma1(w[56]) + w[51] + sha256SmallSigma0(w[43]) + w[42]
    t1 = f + sha256BigSigma1(c) + sha256Choose(c, d, e) + 0x84c87814 + w[58]
    b += t1
    f = t1 + sha256BigSigma0(g) + sha256Majority(g, hh, a)
    w[59] = sha256SmallSigma1(w[57]) + w[52] + sha256SmallSigma0(w[44]) + w[43]
    t1 = e + sha256BigSigma1(b) + sha256Choose(b, c, d) + 0x8cc70208 + w[59]
    a += t1
    e = t1 + sha256BigSigma0(f) + sha256Majority(f, g, hh)
    w[60] = sha256SmallSigma1(w[58]) + w[53] + sha256SmallSigma0(w[45]) + w[44]
    t1 = d + sha256BigSigma1(a) + sha256Choose(a, b, c) + 0x90befffa + w[60]
    hh += t1
    d = t1 + sha256BigSigma0(e) + sha256Majority(e, f, g)
    w[61] = sha256SmallSigma1(w[59]) + w[54] + sha256SmallSigma0(w[46]) + w[45]
    t1 = c + sha256BigSigma1(hh) + sha256Choose(hh, a, b) + 0xa4506ceb + w[61]
    g += t1
    c = t1 + sha256BigSigma0(d) + sha256Majority(d, e, f)
    w[62] = sha256SmallSigma1(w[60]) + w[55] + sha256SmallSigma0(w[47]) + w[46]
    t1 = b + sha256BigSigma1(g) + sha256Choose(g, hh, a) + 0xbef9a3f7 + w[62]
    f += t1
    b = t1 + sha256BigSigma0(c) + sha256Majority(c, d, e)
    w[63] = sha256SmallSigma1(w[61]) + w[56] + sha256SmallSigma0(w[48]) + w[47]
    t1 = a + sha256BigSigma1(f) + sha256Choose(f, g, hh) + 0xc67178f2 + w[63]
    e += t1
    a = t1 + sha256BigSigma0(b) + sha256Majority(b, c, d)
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

/**
 * The SHA-256 digest of all of `data`, as a fresh 32-byte array.
 *
 * An array longer than 2^31 - 1 bytes panics. A window's length is an `i32`,
 * and under `--number-mode f64` `toI32` of a longer length saturates, so
 * hashing `toI32(data.length)` bytes would answer the digest of a prefix: one
 * digest for every message that shares its first 2^31 - 1 bytes. The length
 * is compared as the `number` it is, before any `toI32`.
 */
export const sha256 = (data: u8[]): u8[] => {
  if (data.length > 2147483647) {
    panic("sha256: a message longer than 2^31 - 1 bytes")
  }
  const hasher: Sha256 = new Sha256()
  const from: i32 = 0
  hasher.update(data, from, toI32(data.length))
  return hasher.digest()
}

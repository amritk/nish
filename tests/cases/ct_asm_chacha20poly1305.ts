// WP34 K2: the constant-time cores of nish/crypto/chacha20poly1305 under the
// assembly check in tests/run.js. The check reads one compiled module and a
// std module is compiled as its own, so these are copies, verbatim apart from
// a `ct` prefix on each name and `export` on the four the check reads:
// ctChacha20Word, ctPoly1305Le64, ctPoly1305Clamp, ctPoly1305Block,
// ctPoly1305Finish and ctChacha20Poly1305TagMatch mirror chacha20Word,
// poly1305Le64, poly1305Clamp, poly1305Block, poly1305Finish and
// chacha20Poly1305TagMatch in std/crypto/chacha20poly1305.ts.
// tests/link/crypto_chacha20poly1305 imports this file and holds the copies to
// the module: it computes RFC 8439's tags with them and compares both answers,
// so a copy that drifts fails there. The key, the accumulator, the message and
// the tag are secret; the offsets and the high bit are public.
// ct-check: ctPoly1305Clamp secret=contents
// ct-check: ctPoly1305Block secret=contents
// ct-check: ctPoly1305Finish secret=contents
// ct-check: ctChacha20Poly1305TagMatch secret=contents

const ctChacha20Word = (buf: u8[], at: i32): u32 =>
  toU32(buf[at]) | (toU32(buf[at + 1]) << 8) | (toU32(buf[at + 2]) << 16) | (toU32(buf[at + 3]) << 24)

const ctPoly1305Le64 = (buf: u8[], at: i32): u64 =>
  toU64(buf[at]) |
  (toU64(buf[at + 1]) << 8) |
  (toU64(buf[at + 2]) << 16) |
  (toU64(buf[at + 3]) << 24) |
  (toU64(buf[at + 4]) << 32) |
  (toU64(buf[at + 5]) << 40) |
  (toU64(buf[at + 6]) << 48) |
  (toU64(buf[at + 7]) << 56)

export const ctPoly1305Clamp = (key: u8[], r: u64[]): void => {
  const lo: u64 = ctPoly1305Le64(key, 0) & ((toU64(0x0ffffffc) << 32) | 0x0fffffff)
  const hi: u64 = ctPoly1305Le64(key, 8) & ((toU64(0x0ffffffc) << 32) | 0x0ffffffc)
  r[0] = lo & 0x3ffffff
  r[1] = (lo >>> 26) & 0x3ffffff
  r[2] = ((lo >>> 52) | (hi << 12)) & 0x3ffffff
  r[3] = (hi >>> 14) & 0x3ffffff
  r[4] = hi >>> 40
}

export const ctPoly1305Block = (h: u64[], r: u64[], m: u8[], at: i32, high: u64): void => {
  const lo: u64 = ctPoly1305Le64(m, at)
  const hi: u64 = ctPoly1305Le64(m, at + 8)
  const h0: u64 = h[0] + (lo & 0x3ffffff)
  const h1: u64 = h[1] + ((lo >>> 26) & 0x3ffffff)
  const h2: u64 = h[2] + (((lo >>> 52) | (hi << 12)) & 0x3ffffff)
  const h3: u64 = h[3] + ((hi >>> 14) & 0x3ffffff)
  const h4: u64 = h[4] + ((hi >>> 40) | high)

  const r0: u64 = r[0]
  const r1: u64 = r[1]
  const r2: u64 = r[2]
  const r3: u64 = r[3]
  const r4: u64 = r[4]
  // A product that lands at limb 5 or above is 2^130 times something, and
  // 2^130 = 5 (mod p), so it comes back in at limb `i - 5` times five.
  const s1: u64 = r1 * 5
  const s2: u64 = r2 * 5
  const s3: u64 = r3 * 5
  const s4: u64 = r4 * 5

  let d0: u64 = h0 * r0 + h1 * s4 + h2 * s3 + h3 * s2 + h4 * s1
  let d1: u64 = h0 * r1 + h1 * r0 + h2 * s4 + h3 * s3 + h4 * s2
  let d2: u64 = h0 * r2 + h1 * r1 + h2 * r0 + h3 * s4 + h4 * s3
  let d3: u64 = h0 * r3 + h1 * r2 + h2 * r1 + h3 * r0 + h4 * s4
  let d4: u64 = h0 * r4 + h1 * r3 + h2 * r2 + h3 * r1 + h4 * r0

  // Carry each limb into the next, and the carry out of limb 4 into limb 0
  // times five; then limb 0's own carry once more.
  d1 = d1 + (d0 >>> 26)
  d2 = d2 + (d1 >>> 26)
  d3 = d3 + (d2 >>> 26)
  d4 = d4 + (d3 >>> 26)
  d0 = (d0 & 0x3ffffff) + (d4 >>> 26) * 5
  h[0] = d0 & 0x3ffffff
  h[1] = (d1 & 0x3ffffff) + (d0 >>> 26)
  h[2] = d2 & 0x3ffffff
  h[3] = d3 & 0x3ffffff
  h[4] = d4 & 0x3ffffff
}

export const ctPoly1305Finish = (h: u64[], key: u8[], tag: u8[]): void => {
  let h0: u64 = h[0]
  let h1: u64 = h[1]
  let h2: u64 = h[2]
  let h3: u64 = h[3]
  let h4: u64 = h[4]
  for (let pass: i32 = 0; pass < 2; pass++) {
    h1 = h1 + (h0 >>> 26)
    h0 = h0 & 0x3ffffff
    h2 = h2 + (h1 >>> 26)
    h1 = h1 & 0x3ffffff
    h3 = h3 + (h2 >>> 26)
    h2 = h2 & 0x3ffffff
    h4 = h4 + (h3 >>> 26)
    h3 = h3 & 0x3ffffff
    h0 = h0 + (h4 >>> 26) * 5
    h4 = h4 & 0x3ffffff
  }

  const g0: u64 = h0 + 5
  const g1: u64 = h1 + (g0 >>> 26)
  const g2: u64 = h2 + (g1 >>> 26)
  const g3: u64 = h3 + (g2 >>> 26)
  const g4: u64 = h4 + (g3 >>> 26) - 0x4000000
  // All ones when `g4` did not borrow, which is when `h >= p` and `g` is the
  // reduced value; all zeros otherwise.
  const keep: u64 = (g4 >>> 63) - 1
  h0 = ctSelect(keep, g0 & 0x3ffffff, h0)
  h1 = ctSelect(keep, g1 & 0x3ffffff, h1)
  h2 = ctSelect(keep, g2 & 0x3ffffff, h2)
  h3 = ctSelect(keep, g3 & 0x3ffffff, h3)
  h4 = ctSelect(keep, g4 & 0x3ffffff, h4)

  const word: u64 = 0xffffffff
  let f: u64 = ((h0 | (h1 << 26)) & word) + toU64(ctChacha20Word(key, 16))
  tag[0] = toU8(f)
  tag[1] = toU8(f >>> 8)
  tag[2] = toU8(f >>> 16)
  tag[3] = toU8(f >>> 24)
  f = (((h1 >>> 6) | (h2 << 20)) & word) + toU64(ctChacha20Word(key, 20)) + (f >>> 32)
  tag[4] = toU8(f)
  tag[5] = toU8(f >>> 8)
  tag[6] = toU8(f >>> 16)
  tag[7] = toU8(f >>> 24)
  f = (((h2 >>> 12) | (h3 << 14)) & word) + toU64(ctChacha20Word(key, 24)) + (f >>> 32)
  tag[8] = toU8(f)
  tag[9] = toU8(f >>> 8)
  tag[10] = toU8(f >>> 16)
  tag[11] = toU8(f >>> 24)
  f = (((h3 >>> 18) | (h4 << 8)) & word) + toU64(ctChacha20Word(key, 28)) + (f >>> 32)
  tag[12] = toU8(f)
  tag[13] = toU8(f >>> 8)
  tag[14] = toU8(f >>> 16)
  tag[15] = toU8(f >>> 24)
}

export const ctChacha20Poly1305TagMatch = (tag: u8[], sealed: u8[], at: i32): u32 => {
  const diff: u32 =
    toU32(tag[0] ^ sealed[at]) |
    toU32(tag[1] ^ sealed[at + 1]) |
    toU32(tag[2] ^ sealed[at + 2]) |
    toU32(tag[3] ^ sealed[at + 3]) |
    toU32(tag[4] ^ sealed[at + 4]) |
    toU32(tag[5] ^ sealed[at + 5]) |
    toU32(tag[6] ^ sealed[at + 6]) |
    toU32(tag[7] ^ sealed[at + 7]) |
    toU32(tag[8] ^ sealed[at + 8]) |
    toU32(tag[9] ^ sealed[at + 9]) |
    toU32(tag[10] ^ sealed[at + 10]) |
    toU32(tag[11] ^ sealed[at + 11]) |
    toU32(tag[12] ^ sealed[at + 12]) |
    toU32(tag[13] ^ sealed[at + 13]) |
    toU32(tag[14] ^ sealed[at + 14]) |
    toU32(tag[15] ^ sealed[at + 15])
  return ctEq(diff, 0)
}

// WP34 K2: the constant-time cores of nish/crypto/chacha20poly1305 under the
// assembly check in tests/run.js. The check reads one compiled module and a
// std module is compiled as its own, so these are copies, verbatim apart from
// a `ct` prefix on each name, `export` on the four the check reads, and each
// index an `uncheckedGet` or `uncheckedSet` from `nish:unsafe`, since a bounds
// check is a branch:
// ctChacha20Word, ctPoly1305Le64, ctPoly1305Clamp, ctPoly1305Block,
// ctPoly1305Finish and ctChacha20Poly1305TagMatch mirror chacha20Word,
// poly1305Le64, poly1305Clamp, poly1305Block, poly1305Finish and
// chacha20Poly1305TagMatch in std/crypto/chacha20poly1305.ts.
// tests/link/crypto_chacha20poly1305 imports this file and holds the copies to
// the module: it computes RFC 8439's tags with them and compares both answers,
// so a copy that drifts fails there. The key, the accumulator, the message and
// the tag are secret; the offsets and the high bit are public.
//
// The `loops` checks read the rest: ctChacha20Rotl, ctChacha20Core,
// ctChacha20XorInto and ctPoly1305AbsorbWhole are the module's chacha20Rotl,
// chacha20Core, chacha20XorInto and the whole-blocks head of poly1305Absorb,
// verbatim apart from the `ct` prefix and `export`: they keep the module's
// checked indexing, since a bounds check's panic ends the program and the
// reading follows only the path that goes on. tests/run.js compares their
// text with the module's, so an edit to one that misses the other fails there.
// ct-check: ctPoly1305Clamp secret=contents
// ct-check: ctPoly1305Block secret=contents
// ct-check: ctPoly1305Finish secret=contents
// ct-check: ctChacha20Poly1305TagMatch secret=contents
// ct-check: ctChacha20Core secret=contents loops
// ct-check: ctChacha20XorInto secret=contents loops
// ct-check: ctPoly1305AbsorbWhole secret=contents loops
// ct-check: ctChacha20XorIntoToZero secret=contents loops expect=branch
// ct-check: ctChacha20SboxStream secret=contents loops expect=load

import { wipe } from "nish:secret"
import { uncheckedGet, uncheckedSet, wrappingAdd } from "nish:unsafe";

const ctChacha20Word = (buf: u8[], at: i32): u32 => {
  return toU32(uncheckedGet(buf, at)) | (toU32(uncheckedGet(buf, wrappingAdd(at, 1))) << 8) | (toU32(uncheckedGet(buf, wrappingAdd(at, 2))) << 16) | (toU32(uncheckedGet(buf, wrappingAdd(at, 3))) << 24)
}

const ctPoly1305Le64 = (buf: u8[], at: i32): u64 => {
  return toU64(uncheckedGet(buf, at)) |
    (toU64(uncheckedGet(buf, wrappingAdd(at, 1))) << 8) |
    (toU64(uncheckedGet(buf, wrappingAdd(at, 2))) << 16) |
    (toU64(uncheckedGet(buf, wrappingAdd(at, 3))) << 24) |
    (toU64(uncheckedGet(buf, wrappingAdd(at, 4))) << 32) |
    (toU64(uncheckedGet(buf, wrappingAdd(at, 5))) << 40) |
    (toU64(uncheckedGet(buf, wrappingAdd(at, 6))) << 48) |
    (toU64(uncheckedGet(buf, wrappingAdd(at, 7))) << 56)
}

export const ctPoly1305Clamp = (key: u8[], r: u64[]): void => {
  const lo: u64 = ctPoly1305Le64(key, 0) & ((toU64(0x0ffffffc) << 32) | 0x0fffffff)
  const hi: u64 = ctPoly1305Le64(key, 8) & ((toU64(0x0ffffffc) << 32) | 0x0ffffffc)
  uncheckedSet(r, 0, lo & 0x3ffffff);
  uncheckedSet(r, 1, (lo >>> 26) & 0x3ffffff);
  uncheckedSet(r, 2, ((lo >>> 52) | (hi << 12)) & 0x3ffffff);
  uncheckedSet(r, 3, (hi >>> 14) & 0x3ffffff);
  uncheckedSet(r, 4, hi >>> 40);
}

export const ctPoly1305Block = (h: u64[], r: u64[], m: u8[], at: i32, high: u64): void => {
  const lo: u64 = ctPoly1305Le64(m, at)
  const hi: u64 = ctPoly1305Le64(m, wrappingAdd(at, 8))
  const h0: u64 = uncheckedGet(h, 0) + (lo & 0x3ffffff)
  const h1: u64 = uncheckedGet(h, 1) + ((lo >>> 26) & 0x3ffffff)
  const h2: u64 = uncheckedGet(h, 2) + (((lo >>> 52) | (hi << 12)) & 0x3ffffff)
  const h3: u64 = uncheckedGet(h, 3) + ((hi >>> 14) & 0x3ffffff)
  const h4: u64 = uncheckedGet(h, 4) + ((hi >>> 40) | high)

  const r0: u64 = uncheckedGet(r, 0)
  const r1: u64 = uncheckedGet(r, 1)
  const r2: u64 = uncheckedGet(r, 2)
  const r3: u64 = uncheckedGet(r, 3)
  const r4: u64 = uncheckedGet(r, 4)
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
  uncheckedSet(h, 0, d0 & 0x3ffffff);
  uncheckedSet(h, 1, (d1 & 0x3ffffff) + (d0 >>> 26));
  uncheckedSet(h, 2, d2 & 0x3ffffff);
  uncheckedSet(h, 3, d3 & 0x3ffffff);
  uncheckedSet(h, 4, d4 & 0x3ffffff);
}

export const ctPoly1305Finish = (h: u64[], key: u8[], tag: u8[]): void => {
  let h0: u64 = uncheckedGet(h, 0)
  let h1: u64 = uncheckedGet(h, 1)
  let h2: u64 = uncheckedGet(h, 2)
  let h3: u64 = uncheckedGet(h, 3)
  let h4: u64 = uncheckedGet(h, 4)
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
  uncheckedSet(tag, 0, toU8(f));
  uncheckedSet(tag, 1, toU8(f >>> 8));
  uncheckedSet(tag, 2, toU8(f >>> 16));
  uncheckedSet(tag, 3, toU8(f >>> 24));
  f = (((h1 >>> 6) | (h2 << 20)) & word) + toU64(ctChacha20Word(key, 20)) + (f >>> 32)
  uncheckedSet(tag, 4, toU8(f));
  uncheckedSet(tag, 5, toU8(f >>> 8));
  uncheckedSet(tag, 6, toU8(f >>> 16));
  uncheckedSet(tag, 7, toU8(f >>> 24));
  f = (((h2 >>> 12) | (h3 << 14)) & word) + toU64(ctChacha20Word(key, 24)) + (f >>> 32)
  uncheckedSet(tag, 8, toU8(f));
  uncheckedSet(tag, 9, toU8(f >>> 8));
  uncheckedSet(tag, 10, toU8(f >>> 16));
  uncheckedSet(tag, 11, toU8(f >>> 24));
  f = (((h3 >>> 18) | (h4 << 8)) & word) + toU64(ctChacha20Word(key, 28)) + (f >>> 32)
  uncheckedSet(tag, 12, toU8(f));
  uncheckedSet(tag, 13, toU8(f >>> 8));
  uncheckedSet(tag, 14, toU8(f >>> 16));
  uncheckedSet(tag, 15, toU8(f >>> 24));
}

export const ctChacha20Poly1305TagMatch = (tag: u8[], sealed: u8[], at: i32): u32 => {
  const diff: u32 =
    toU32(uncheckedGet(tag, 0) ^ uncheckedGet(sealed, at)) |
    toU32(uncheckedGet(tag, 1) ^ uncheckedGet(sealed, wrappingAdd(at, 1))) |
    toU32(uncheckedGet(tag, 2) ^ uncheckedGet(sealed, wrappingAdd(at, 2))) |
    toU32(uncheckedGet(tag, 3) ^ uncheckedGet(sealed, wrappingAdd(at, 3))) |
    toU32(uncheckedGet(tag, 4) ^ uncheckedGet(sealed, wrappingAdd(at, 4))) |
    toU32(uncheckedGet(tag, 5) ^ uncheckedGet(sealed, wrappingAdd(at, 5))) |
    toU32(uncheckedGet(tag, 6) ^ uncheckedGet(sealed, wrappingAdd(at, 6))) |
    toU32(uncheckedGet(tag, 7) ^ uncheckedGet(sealed, wrappingAdd(at, 7))) |
    toU32(uncheckedGet(tag, 8) ^ uncheckedGet(sealed, wrappingAdd(at, 8))) |
    toU32(uncheckedGet(tag, 9) ^ uncheckedGet(sealed, wrappingAdd(at, 9))) |
    toU32(uncheckedGet(tag, 10) ^ uncheckedGet(sealed, wrappingAdd(at, 10))) |
    toU32(uncheckedGet(tag, 11) ^ uncheckedGet(sealed, wrappingAdd(at, 11))) |
    toU32(uncheckedGet(tag, 12) ^ uncheckedGet(sealed, wrappingAdd(at, 12))) |
    toU32(uncheckedGet(tag, 13) ^ uncheckedGet(sealed, wrappingAdd(at, 13))) |
    toU32(uncheckedGet(tag, 14) ^ uncheckedGet(sealed, wrappingAdd(at, 14))) |
    toU32(uncheckedGet(tag, 15) ^ uncheckedGet(sealed, wrappingAdd(at, 15)))
  return ctEq(diff, 0)
}

const CT_POLY1305_HIGH_BIT: i32 = 0x1000000

const ctChacha20Rotl = (x: u32, n: u32): u32 => (x << n) | (x >>> (32 - n))

export const ctChacha20Core = (state: u32[], out: u32[]): void => {
  if (toI32(state.length) < 16 || toI32(out.length) < 16) {
    return
  }
  let x0: u32 = state[0]
  let x1: u32 = state[1]
  let x2: u32 = state[2]
  let x3: u32 = state[3]
  let x4: u32 = state[4]
  let x5: u32 = state[5]
  let x6: u32 = state[6]
  let x7: u32 = state[7]
  let x8: u32 = state[8]
  let x9: u32 = state[9]
  let x10: u32 = state[10]
  let x11: u32 = state[11]
  let x12: u32 = state[12]
  let x13: u32 = state[13]
  let x14: u32 = state[14]
  let x15: u32 = state[15]
  for (let round: i32 = 0; round < 10; round++) {
    // The column round.
    x0 = x0 + x4
    x12 = ctChacha20Rotl(x12 ^ x0, 16)
    x8 = x8 + x12
    x4 = ctChacha20Rotl(x4 ^ x8, 12)
    x0 = x0 + x4
    x12 = ctChacha20Rotl(x12 ^ x0, 8)
    x8 = x8 + x12
    x4 = ctChacha20Rotl(x4 ^ x8, 7)
    x1 = x1 + x5
    x13 = ctChacha20Rotl(x13 ^ x1, 16)
    x9 = x9 + x13
    x5 = ctChacha20Rotl(x5 ^ x9, 12)
    x1 = x1 + x5
    x13 = ctChacha20Rotl(x13 ^ x1, 8)
    x9 = x9 + x13
    x5 = ctChacha20Rotl(x5 ^ x9, 7)
    x2 = x2 + x6
    x14 = ctChacha20Rotl(x14 ^ x2, 16)
    x10 = x10 + x14
    x6 = ctChacha20Rotl(x6 ^ x10, 12)
    x2 = x2 + x6
    x14 = ctChacha20Rotl(x14 ^ x2, 8)
    x10 = x10 + x14
    x6 = ctChacha20Rotl(x6 ^ x10, 7)
    x3 = x3 + x7
    x15 = ctChacha20Rotl(x15 ^ x3, 16)
    x11 = x11 + x15
    x7 = ctChacha20Rotl(x7 ^ x11, 12)
    x3 = x3 + x7
    x15 = ctChacha20Rotl(x15 ^ x3, 8)
    x11 = x11 + x15
    x7 = ctChacha20Rotl(x7 ^ x11, 7)
    // The diagonal round.
    x0 = x0 + x5
    x15 = ctChacha20Rotl(x15 ^ x0, 16)
    x10 = x10 + x15
    x5 = ctChacha20Rotl(x5 ^ x10, 12)
    x0 = x0 + x5
    x15 = ctChacha20Rotl(x15 ^ x0, 8)
    x10 = x10 + x15
    x5 = ctChacha20Rotl(x5 ^ x10, 7)
    x1 = x1 + x6
    x12 = ctChacha20Rotl(x12 ^ x1, 16)
    x11 = x11 + x12
    x6 = ctChacha20Rotl(x6 ^ x11, 12)
    x1 = x1 + x6
    x12 = ctChacha20Rotl(x12 ^ x1, 8)
    x11 = x11 + x12
    x6 = ctChacha20Rotl(x6 ^ x11, 7)
    x2 = x2 + x7
    x13 = ctChacha20Rotl(x13 ^ x2, 16)
    x8 = x8 + x13
    x7 = ctChacha20Rotl(x7 ^ x8, 12)
    x2 = x2 + x7
    x13 = ctChacha20Rotl(x13 ^ x2, 8)
    x8 = x8 + x13
    x7 = ctChacha20Rotl(x7 ^ x8, 7)
    x3 = x3 + x4
    x14 = ctChacha20Rotl(x14 ^ x3, 16)
    x9 = x9 + x14
    x4 = ctChacha20Rotl(x4 ^ x9, 12)
    x3 = x3 + x4
    x14 = ctChacha20Rotl(x14 ^ x3, 8)
    x9 = x9 + x14
    x4 = ctChacha20Rotl(x4 ^ x9, 7)
  }
  out[0] = x0 + state[0]
  out[1] = x1 + state[1]
  out[2] = x2 + state[2]
  out[3] = x3 + state[3]
  out[4] = x4 + state[4]
  out[5] = x5 + state[5]
  out[6] = x6 + state[6]
  out[7] = x7 + state[7]
  out[8] = x8 + state[8]
  out[9] = x9 + state[9]
  out[10] = x10 + state[10]
  out[11] = x11 + state[11]
  out[12] = x12 + state[12]
  out[13] = x13 + state[13]
  out[14] = x14 + state[14]
  out[15] = x15 + state[15]
}

export const ctChacha20XorInto = (state: u32[], src: u8[], srcAt: i32, len: i32, dst: u8[], dstAt: i32): void => {
  const keystream: u32[] = new Array<u32>(16)
  let done: i32 = 0
  while (done < len) {
    ctChacha20Core(state, keystream)
    state[12] = state[12] + 1
    const take: i32 = len - done < 64 ? len - done : 64
    for (let w: i32 = 0; w < 16 && w < toI32(keystream.length); w++) {
      const word: u32 = keystream[w]
      const at: i32 = done + 4 * w
      if (at + 4 <= done + take) {
        // A whole word, the common case: four bytes with fixed shifts.
        dst[dstAt + at] = src[srcAt + at] ^ toU8(word)
        dst[dstAt + at + 1] = src[srcAt + at + 1] ^ toU8(word >>> 8)
        dst[dstAt + at + 2] = src[srcAt + at + 2] ^ toU8(word >>> 16)
        dst[dstAt + at + 3] = src[srcAt + at + 3] ^ toU8(word >>> 24)
      } else {
        for (let k: i32 = 0; at + k < done + take; k++) {
          dst[dstAt + at + k] = src[srcAt + at + k] ^ toU8(word >>> toU32(8 * k))
        }
      }
    }
    done = done + take
  }
  wipe(keystream)
}

// Only the whole-blocks loop of poly1305Absorb: its padded tail copies the
// message into a stack array at a counted index, a store this reading cannot
// place, so the tail stays discipline (docs/security/ct-verification.md).
export const ctPoly1305AbsorbWhole = (h: u64[], r: u64[], buf: u8[], at: i32, len: i32): void => {
  const whole: i32 = len >> 4
  for (let i: i32 = 0; i < whole; i++) {
    ctPoly1305Block(h, r, buf, at + 16 * i, toU64(CT_POLY1305_HIGH_BIT))
  }
}

// The loop checks' refusals. `ctChacha20XorIntoToZero` stops the word loop at
// the first zero keystream word, a secret-bound loop the reading refuses as a
// branch; `ctChacha20SboxStream` carries each keystream byte across the back
// edge into a table index, which it refuses as a load.
export const ctChacha20XorIntoToZero = (keystream: u32[], dst: u8[]): void => {
  for (let w: i32 = 0; w < 16 && uncheckedGet(keystream, w) !== 0; w++) {
    uncheckedSet(dst, w, toU8(uncheckedGet(keystream, w)))
  }
}

export const ctChacha20SboxStream = (keystream: u8[], table: u8[], dst: u8[]): void => {
  let carry: u8 = 0
  for (let i: i32 = 0; i < 16; i++) {
    uncheckedSet(dst, i, carry)
    carry = uncheckedGet(table, toI32(uncheckedGet(keystream, i)))
  }
}

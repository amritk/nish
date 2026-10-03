// Crypto K1: `nish/crypto/base64url`'s character maps under the assembly check
// in tests/run.js. The module encodes keys, nonces and tags, and it maps a
// sextet to a character and back by arithmetic on range masks rather than a
// table, so that no load is ever addressed by a secret. That promise is about
// the machine code — LLVM turns a `switch` or a chain of compares into a
// lookup table when it likes — so the maps are copied here verbatim from
// std/crypto/base64url.ts, `export` and the indexing aside, and read after
// `clang -O2`.
//
// A golden case compiles to one module, so it cannot import the library.
// Beside the maps, one group each way: `base64urlEncodeGroup` is the encoder's
// accumulator run over three bytes, as the module writes it, and
// `base64urlDecodeGroup` the decoder's over four characters, its steps the
// module's with the position test resolved by hand (the comment on it says
// why). What they
// leave out is what is public or is not arithmetic: the decoder's `j < outLen`
// store guard, and the encoder's `String.fromCharCode` and `push`, which copy
// a character into a fresh string (a call this check refuses by rule; the
// byte is stored, never used as an address). Here a character is a byte of a
// `u8[]`, since a `string` does not arrive in a register.
//
// Every value below is secret. Every index is an `uncheckedGet` or
// `uncheckedSet` from `nish:unsafe`, since a bounds check is a branch. tests/link/crypto_base64url_k1_copies holds
// each function to the module on every sextet, every byte and generated groups,
// so a copy that drifts from std/crypto/base64url.ts fails there.
// ct-check: base64urlCharOf secret=v
// ct-check: base64urlSextetOf secret=c
// ct-check: base64urlEncodeGroup secret=contents
// ct-check: base64urlDecodeGroup secret=contents

import { uncheckedGet, uncheckedSet } from "nish:unsafe";

// Verbatim: `base64urlRangeMask`.
const base64urlRangeMask = (c: i32, lo: i32, hi: i32): i32 => ((lo - 1 - c) & (c - hi - 1)) >> 31

// Verbatim: `base64urlCharOf`.
export const base64urlCharOf = (v: i32): i32 =>
  65 +
  v +
  (base64urlRangeMask(v, 26, 63) & 6) -
  (base64urlRangeMask(v, 52, 63) & 75) -
  (base64urlRangeMask(v, 62, 63) & 13) +
  (base64urlRangeMask(v, 63, 63) & 49)

// Verbatim: `base64urlSextetOf`.
export const base64urlSextetOf = (c: i32): i32 => {
  const upper: i32 = base64urlRangeMask(c, 65, 90)
  const lower: i32 = base64urlRangeMask(c, 97, 122)
  const digit: i32 = base64urlRangeMask(c, 48, 57)
  const dash: i32 = base64urlRangeMask(c, 45, 45)
  const underscore: i32 = base64urlRangeMask(c, 95, 95)
  const value: i32 =
    (upper & (c - 65)) | (lower & (c - 71)) | (digit & (c + 4)) | (dash & 62) | (underscore & 63)
  return value | ~(upper | lower | digit | dash | underscore)
}

// `base64urlEncode`'s loop over one whole group: `data[0 .. 3)` to the four
// characters `out[0 .. 4)`.
export const base64urlEncodeGroup = (data: u8[], out: u8[]): void => {
  let acc: i32 = 0
  let bits: i32 = 0
  let j: i32 = 0
  for (let k: i32 = 0; k < 3; k++) {
    acc = ((acc << 8) | toI32(uncheckedGet(data, k))) & 0xfff
    bits += 8
    while (bits >= 6) {
      bits -= 6
      uncheckedSet(out, j, toU8(base64urlCharOf((acc >> bits) & 63)));
      j++
    }
  }
}

// `base64urlDecode`'s loop over one whole group: the four characters
// `text[0 .. 4)` to `out[0 .. 3)`. Answers the module's `bad`: non-zero when a
// character is outside the alphabet. Each step is the module's loop body; the
// loop is unrolled by hand, with its position test resolved (a byte is ready
// after the second, third and fourth characters, with 4, 2 and 0 bits left),
// because `clang -O2` keeps that test as a loop branch rather than unrolling
// four iterations — a branch on the position, which the check refuses anyway.
export const base64urlDecodeGroup = (text: u8[], out: u8[]): i32 => {
  let bad: i32 = 0
  let acc: i32 = 0
  const v0: i32 = base64urlSextetOf(toI32(uncheckedGet(text, 0)))
  bad = bad | (v0 >> 31)
  acc = ((acc << 6) | (v0 & 63)) & 0xfff
  const v1: i32 = base64urlSextetOf(toI32(uncheckedGet(text, 1)))
  bad = bad | (v1 >> 31)
  acc = ((acc << 6) | (v1 & 63)) & 0xfff
  uncheckedSet(out, 0, toU8((acc >> 4) & 255));
  const v2: i32 = base64urlSextetOf(toI32(uncheckedGet(text, 2)))
  bad = bad | (v2 >> 31)
  acc = ((acc << 6) | (v2 & 63)) & 0xfff
  uncheckedSet(out, 1, toU8((acc >> 2) & 255));
  const v3: i32 = base64urlSextetOf(toI32(uncheckedGet(text, 3)))
  bad = bad | (v3 >> 31)
  acc = ((acc << 6) | (v3 & 63)) & 0xfff
  uncheckedSet(out, 2, toU8(acc & 255));
  return bad
}

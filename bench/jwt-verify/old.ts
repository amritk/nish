// The decoder of std/crypto/base64url.ts, frozen by bench/jwt-verify/freeze.mjs
// at 1d92417efafbc554c7dcb4d8929143c9fc24160e
// with its three names prefixed `b64a`: the `decode-old` kernel's. A comment
// below that names another function or the module comment means
// std/crypto/base64url.ts's at that commit. Do not edit; rerun freeze.mjs.
/**
 * All ones when `lo <= c <= hi`, else zero, without a branch. `c` is a byte or
 * a sextet, so neither subtraction could leave `i32`; they are written in
 * `u32`, which wraps by definition, because a signed one would be checked for
 * an overflow it cannot have, and the check is a branch on the secret. The
 * sign bit `>> 31` reads is the same either way. `base64urlCharOf` and
 * `b64aSextetOf` do their sums in `u32` for the same reason.
 */
const b64aRangeMask = (c: i32, lo: i32, hi: i32): i32 =>
  toI32((toU32(lo) - 1 - toU32(c)) & (toU32(c) - toU32(hi) - 1)) >> 31

/**
 * The sextet the byte `c` stands for, or `-1` when `c` is not in the alphabet.
 * Each range contributes its value under its own mask, and a byte in none of
 * them has every bit set by the final OR.
 */
const b64aSextetOf = (c: i32): i32 => {
  const upper: i32 = b64aRangeMask(c, 65, 90)
  const lower: i32 = b64aRangeMask(c, 97, 122)
  const digit: i32 = b64aRangeMask(c, 48, 57)
  const dash: i32 = b64aRangeMask(c, 45, 45)
  const underscore: i32 = b64aRangeMask(c, 95, 95)
  const value: i32 =
    (upper & toI32(toU32(c) - 65)) |
    (lower & toI32(toU32(c) - 71)) |
    (digit & toI32(toU32(c) + 4)) |
    (dash & 62) |
    (underscore & 63)
  return value | ~(upper | lower | digit | dash | underscore)
}

/**
 * The bytes `text` spells in unpadded base64url, or `null` when it is not the
 * one canonical spelling of any byte string — see the module comment for the
 * five refusals.
 *
 * The same accumulator as `base64urlEncode`, run the other way: six bits in per
 * character, eight out per byte.
 */
export const b64aDecode = (text: string): u8[] | null => {
  // A text past 2^31 - 1 bytes is refused before `toI32`, which would
  // saturate it under `--number-mode f64` and decode only a prefix: a second
  // spelling of that prefix's bytes, which strictness exists to refuse.
  if (text.length > 2147483647) {
    return null
  }
  const n: i32 = toI32(text.length)
  const tail: i32 = n & 3
  // Six bits cannot finish a byte, so a single character after the last full
  // group spells nothing.
  if (tail === 1) {
    return null
  }
  // Three bytes per full group of four, and one fewer than the characters in a
  // short final group; `n * 3 / 4` would overflow for a text over 700 MB.
  const out: u8[] = new Array<u8>((n >> 2) * 3 + (tail === 0 ? 0 : tail - 1))
  const outLen: i32 = toI32(out.length)
  // All ones once any character is outside the alphabet (its sextet of `-1`
  // shifted right by 31), and non-zero once the text ends on a bit that
  // encodes no byte.
  let bad: i32 = 0
  let acc: i32 = 0
  let bits: i32 = 0
  let j: i32 = 0
  for (let k: i32 = 0; k < n; k++) {
    const v: i32 = b64aSextetOf(toI32(text.charCodeAt(k)))
    bad = bad | (v >> 31)
    acc = ((acc << 6) | (v & 63)) & 0xfff
    bits += 6
    if (bits >= 8) {
      bits -= 8
      // Always true — `out` was sized from the same length — but written out
      // so that the store keeps no bounds check.
      if (j >= 0 && j < outLen) {
        out[j] = toU8((acc >> bits) & 255)
      }
      j++
    }
  }
  // The two or four bits left over belong to no byte, and must be zero so that
  // `AA` is the only spelling of a zero byte and `AB` is refused (RFC 4648 §3.5).
  bad = bad | (acc & ((1 << bits) - 1))
  if (bad !== 0) {
    return null
  }
  return out
}

/**
 * `nish/crypto/base64url` — RFC 4648 §5 base64url, unpadded, as JWS and the
 * relay's grants spell a key or a tag inside a URL or a header.
 *
 * The alphabet is `A-Z a-z 0-9 - _`, and there is no `=`: the length of the
 * text already says how many bytes the last group holds (RFC 4648 §3.2 lets a
 * specification that knows its lengths drop the padding, and RFC 7515 §2 does).
 *
 * **Decoding is strict, so that each byte string has exactly one spelling.**
 * `base64urlDecode` answers `null` for a `=` anywhere, for any character outside
 * the alphabet (whitespace included), for a length of 1 mod 4 — six bits, not a
 * byte — and for a final character whose unused low bits are not zero (RFC 4648
 * §3.5). A lenient decoder would let `AB` and `AA` both mean `00`, and a token
 * compared or cached by its text would then have two identities.
 *
 * **Neither direction indexes or branches on the data.** What is encoded here
 * is usually a key, a nonce or a MAC, and a lookup table indexed by a secret
 * sextet leaves its trace in the cache. So a sextet becomes a character, and a
 * character a sextet, by arithmetic on range masks: `(lo - 1 - c) & (c - hi - 1)`
 * is negative exactly when `lo <= c <= hi`, and an arithmetic shift by 31 turns
 * that sign into an all-ones or all-zeros mask. A malformed character is not
 * refused where it is found either: the verdict is ORed into one word and read
 * once, after the whole text. The text's length is public and is tested first.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */

/**
 * All ones when `lo <= c <= hi`, else zero, without a branch. `c` is a byte or
 * a sextet, so neither subtraction can overflow.
 */
const base64urlRangeMask = (c: i32, lo: i32, hi: i32): i32 => ((lo - 1 - c) & (c - hi - 1)) >> 31

/**
 * The URL-alphabet character for the sextet `v` (`0 <= v <= 63`).
 *
 * It starts from `'A' + v` and adds, for each range `v` has passed, the step
 * from the previous range's first character to this one's: 26 lands on `a`, 52
 * on `0`, 62 on `-` and 63 on `_`.
 */
const base64urlCharOf = (v: i32): i32 =>
  65 +
  v +
  (base64urlRangeMask(v, 26, 63) & 6) -
  (base64urlRangeMask(v, 52, 63) & 75) -
  (base64urlRangeMask(v, 62, 63) & 13) +
  (base64urlRangeMask(v, 63, 63) & 49)

/**
 * The sextet the byte `c` stands for, or `-1` when `c` is not in the alphabet.
 * Each range contributes its value under its own mask, and a byte in none of
 * them has every bit set by the final OR.
 */
const base64urlSextetOf = (c: i32): i32 => {
  const upper: i32 = base64urlRangeMask(c, 65, 90)
  const lower: i32 = base64urlRangeMask(c, 97, 122)
  const digit: i32 = base64urlRangeMask(c, 48, 57)
  const dash: i32 = base64urlRangeMask(c, 45, 45)
  const underscore: i32 = base64urlRangeMask(c, 95, 95)
  const value: i32 =
    (upper & (c - 65)) | (lower & (c - 71)) | (digit & (c + 4)) | (dash & 62) | (underscore & 63)
  return value | ~(upper | lower | digit | dash | underscore)
}

/**
 * `data` as unpadded base64url: four characters per three bytes, and two or
 * three for a short final group.
 *
 * Bytes go into a bit accumulator eight at a time and come out six at a time,
 * so one index walks the input and the only branches are on how many bits are
 * waiting — which depends on the position, never on the bytes.
 */
export const base64urlEncode = (data: u8[]): string => {
  const parts: string[] = []
  let acc: i32 = 0
  let bits: i32 = 0
  for (let k: i32 = 0; k < toI32(data.length); k++) {
    // At most four bits wait from the bytes before, so twelve are live here;
    // the mask keeps the accumulator from growing without bound.
    acc = ((acc << 8) | toI32(data[k])) & 0xfff
    bits += 8
    while (bits >= 6) {
      bits -= 6
      parts.push(String.fromCharCode(base64urlCharOf((acc >> bits) & 63)))
    }
  }
  // Two or four bits of a final byte are left: they go out as the high bits of
  // one more sextet, filled out with zeros.
  if (bits > 0) {
    parts.push(String.fromCharCode(base64urlCharOf((acc << (6 - bits)) & 63)))
  }
  return parts.join("")
}

/**
 * The bytes `text` spells in unpadded base64url, or `null` when it is not the
 * one canonical spelling of any byte string — see the module comment for the
 * four refusals.
 *
 * The same accumulator as `base64urlEncode`, run the other way: six bits in per
 * character, eight out per byte.
 */
export const base64urlDecode = (text: string): u8[] | null => {
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
    const v: i32 = base64urlSextetOf(toI32(text.charCodeAt(k)))
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

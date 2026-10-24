/**
 * `nish/base64` — standard base64 (RFC 4648 §4) with `=` padding, the encoding
 * kitty graphics frames are sent in.
 *
 * The alphabet is `A-Z a-z 0-9 + /`. Every three bytes become four characters,
 * and a final group of one or two bytes becomes two or three characters filled
 * out to four with `=` (RFC 4648 §4, the padding rules of §3.2), so the text is
 * always a multiple of four long.
 *
 * - `base64EncodedLength(n)` is the characters `n` bytes encode to.
 * - `base64EncodeInto(src, off, len, dst, at)` writes the encoding of
 *   `src[off..off+len)` into `dst` from `at` and allocates nothing, so a frame
 *   can be encoded chunk by chunk straight into its output buffer.
 * - `base64Encode(bytes)` is the whole array as a string.
 *
 * This module only encodes: what it is for writes base64 and never reads it
 * back. It is not the strict decoder of `nish/crypto/base64url`, which is a
 * different alphabet without padding and is written not to branch on the data;
 * what goes through here is pixels, not secrets, so a sextet becomes its
 * character by indexing the alphabet. The output is ASCII, so the string is
 * the same bytes natively and under Node.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */

/** The 64 characters of RFC 4648 §4's Table 1, in value order. */
const BASE64_ALPHABET: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

/** `=`, which fills a short final group out to four characters (RFC 4648 §3.2). */
const BASE64_PAD: i32 = 61

/**
 * The characters `n` bytes encode to: four for every three, a short final
 * group counted as a whole one. Panics when `n` is negative or the length
 * would pass 2^31 - 1, which `n` above 1,610,612,733 does.
 */
export const base64EncodedLength = (n: i32): i32 => {
  if (n < 0) {
    panic("base64EncodedLength: a negative byte count")
  }
  // (2^31 - 1) / 4 * 3 groups' worth of bytes is the most whose encoding fits.
  if (n > 1610612733) {
    panic("base64EncodedLength: the encoding is longer than 2^31 - 1 characters")
  }
  return (((n + 2) / 3) | 0) * 4
}

/** The byte of the character for the sextet `v` (`0 <= v <= 63`). */
const base64CharOf = (v: i32): u8 => toU8(BASE64_ALPHABET.charCodeAt(v))

/**
 * Write the base64 of `src[off..off+len)` into `dst` from index `at`, and
 * answer the index just past the last character written, which is
 * `at + base64EncodedLength(len)`. Nothing is allocated. Panics when the source
 * range is not inside `src` or the encoding does not fit in `dst` from `at`;
 * both are checked before anything is written.
 */
export const base64EncodeInto = (src: u8[], off: i32, len: i32, dst: u8[], at: i32): i32 => {
  // Refused before `toI32`, which saturates a longer length under
  // `--number-mode f64` and would let a range past the true end through.
  if (src.length > 2147483647 || dst.length > 2147483647) {
    panic("base64EncodeInto: an array longer than 2^31 - 1 bytes")
  }
  const srcLength: i32 = toI32(src.length)
  const dstLength: i32 = toI32(dst.length)
  if (off < 0 || len < 0 || off > srcLength - len) {
    panic("base64EncodeInto: the source range is outside the array")
  }
  const need: i32 = base64EncodedLength(len)
  if (at < 0 || at > dstLength - need) {
    panic("base64EncodeInto: the encoding does not fit in the destination")
  }
  let i: i32 = off
  let o: i32 = at
  const whole: i32 = off + len - (len % 3)
  // The checks above make every term after the first true; they are written out
  // because they are what proves the loop's accesses in range.
  while (i < whole && i >= 0 && i + 2 < srcLength && o >= 0 && o + 3 < dstLength) {
    const group: i32 = (toI32(src[i]) << 16) | (toI32(src[i + 1]) << 8) | toI32(src[i + 2])
    dst[o] = base64CharOf(group >> 18)
    dst[o + 1] = base64CharOf((group >> 12) & 63)
    dst[o + 2] = base64CharOf((group >> 6) & 63)
    dst[o + 3] = base64CharOf(group & 63)
    i = i + 3
    o = o + 4
  }
  const tail: i32 = len % 3
  if (tail === 1) {
    const group: i32 = toI32(src[i]) << 16
    dst[o] = base64CharOf(group >> 18)
    dst[o + 1] = base64CharOf((group >> 12) & 63)
    dst[o + 2] = toU8(BASE64_PAD)
    dst[o + 3] = toU8(BASE64_PAD)
    o = o + 4
  } else if (tail === 2) {
    const group: i32 = (toI32(src[i]) << 16) | (toI32(src[i + 1]) << 8)
    dst[o] = base64CharOf(group >> 18)
    dst[o + 1] = base64CharOf((group >> 12) & 63)
    dst[o + 2] = base64CharOf((group >> 6) & 63)
    dst[o + 3] = toU8(BASE64_PAD)
    o = o + 4
  }
  return o
}

/** `bytes` as padded base64. Panics past 1,610,612,733 bytes, whose encoding would not fit a string. */
export const base64Encode = (bytes: u8[]): string => {
  if (bytes.length > 2147483647) {
    panic("base64Encode: more than 2^31 - 1 bytes")
  }
  const n: i32 = toI32(bytes.length)
  const out: u8[] = new Array<u8>(base64EncodedLength(n))
  const end: i32 = base64EncodeInto(bytes, 0, n, out, 0)
  return String.fromBytes(out, 0, end)
}

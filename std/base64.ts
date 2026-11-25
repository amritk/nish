/**
 * `nish/base64` — standard base64 (RFC 4648 §4) with `=` padding, the encoding
 * kitty graphics frames are sent in.
 *
 *     import { base64Encode, base64EncodeInto, base64EncodedLength } from "nish/base64";
 *
 *     export const main = (): i32 => {
 *       const hi: u8[] = [72, 105];                    // "Hi"
 *       const text: string = base64Encode(hi);         // "SGk="
 *       const out: u8[] = new Array<u8>(base64EncodedLength(2) + 1);
 *       const end: i32 = base64EncodeInto(hi, 0, 2, out, 1); // out[1..5) is "SGk=", end is 5
 *       return end;
 *     };
 *
 * **The alphabet is `A-Z a-z 0-9 + /`.** Every three bytes become four characters,
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
 * **This module only encodes**: what it is for writes base64 and never reads it
 * back. It is not the strict decoder of `nish/crypto/base64url`, which is a
 * different alphabet without padding and is written not to branch on the data;
 * what goes through here is pixels, not secrets, so a sextet becomes its
 * character by indexing the alphabet. The output is ASCII, so the string is
 * the same bytes natively and under Node.
 *
 * **Private helpers carry the module's name** because they share the
 * importing program's flat symbol namespace (`docs/wp26-stdlib.md` §3e).
 */

/** The 64 characters of RFC 4648 §4's Table 1, in value order. */
const BASE64_ALPHABET: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

/** `=`, which fills a short final group out to four characters (RFC 4648 §3.2). */
const BASE64_PAD: i32 = 61

/**
 * The characters `n` bytes encode to: four for every three, a short final
 * group counted as a whole one. Panics when `n` is negative or the length
 * would pass 2^31 - 1, which `n` above 1,610,612,733 does.
 *
 * @param n How many bytes are to be encoded; zero answers zero.
 * @returns The number of base64 characters, padding included, that `n` bytes
 *   encode to: always a multiple of four.
 */
export const base64EncodedLength = (n: i32): i32 => {
  if (n < 0) {
    panic("base64EncodedLength: a negative byte count")
  }
  // (2^31 - 1) / 4 * 3 groups' worth of bytes is the most whose encoding fits.
  if (n > 1610612733) {
    panic("base64EncodedLength: the encoding is longer than 2^31 - 1 characters")
  }
  const groups: i32 = toI32((n + 2) / 3)
  return groups * 4
}

/**
 * Write the base64 of `src[off..off+len)` into `dst` from index `at`, and
 * answer the index just past the last character written, which is
 * `at + base64EncodedLength(len)`. Nothing is allocated. Panics when the source
 * range is not inside `src` or the encoding does not fit in `dst` from `at`;
 * both are checked before anything is written.
 *
 * @param src The bytes to encode from; only `src[off..off+len)` is read.
 * @param off Where in `src` the bytes to encode start.
 * @param len How many bytes of `src` to encode; zero writes nothing and
 *   answers `at`.
 * @param dst The buffer the characters are written into, one ASCII byte per
 *   character; bytes outside the written range are left as they were.
 * @param at Where in `dst` the first character goes.
 * @returns The index in `dst` just past the last character written.
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
  if (at < 0 || need > dstLength - at) {
    panic("base64EncodeInto: the encoding does not fit in the destination")
  }
  // A local, so that `abc.length >= 64` below is a fact about the string each
  // character is read from.
  const abc: string = BASE64_ALPHABET
  let i: i32 = off
  let o: i32 = at
  let rest: i32 = len
  // The checks above make every term after the first true; they are written out
  // because they are what proves the loop's accesses in range.
  while (rest >= 3 && i >= 0 && i < srcLength - 2 && o >= 0 && o < dstLength - 3 && abc.length >= 64) {
    const group: i32 = (toI32(src[i]) << 16) | (toI32(src[i + 1]) << 8) | toI32(src[i + 2])
    dst[o] = toU8(abc.charCodeAt((group >> 18) & 63))
    dst[o + 1] = toU8(abc.charCodeAt((group >> 12) & 63))
    dst[o + 2] = toU8(abc.charCodeAt((group >> 6) & 63))
    dst[o + 3] = toU8(abc.charCodeAt(group & 63))
    i = i + 3
    o = o + 4
    rest = rest - 3
  }
  // A short final group of one or two bytes, padded. As in the loop, the
  // checks above make every term after the first false.
  if (rest === 0 || i < 0 || i >= srcLength || o < 0 || o >= dstLength - 3 || abc.length < 64) {
    return o
  }
  let group: i32 = toI32(src[i]) << 16
  if (rest === 2 && i < srcLength - 1) {
    group = group | (toI32(src[i + 1]) << 8)
  }
  dst[o] = toU8(abc.charCodeAt((group >> 18) & 63))
  dst[o + 1] = toU8(abc.charCodeAt((group >> 12) & 63))
  dst[o + 2] = rest === 2 ? toU8(abc.charCodeAt((group >> 6) & 63)) : toU8(BASE64_PAD)
  dst[o + 3] = toU8(BASE64_PAD)
  return o + 4
}

/**
 * `bytes` as padded base64. Panics past 1,610,612,733 bytes, whose encoding
 * would not fit a string.
 *
 * @param bytes The bytes to encode, all of them; an empty array answers `""`.
 * @returns A fresh string holding the padded encoding.
 */
export const base64Encode = (bytes: u8[]): string => {
  // `base64EncodedLength` refuses a count past 1,610,612,733, and the largest
  // `i32` that `toI32` saturates a longer length to under `--number-mode f64`.
  const n: i32 = toI32(bytes.length)
  const out: u8[] = new Array<u8>(base64EncodedLength(n))
  const end: i32 = base64EncodeInto(bytes, 0, n, out, 0)
  return String.fromBytes(out, 0, end)
}

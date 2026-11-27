/**
 * `nish/crypto/base64url` — RFC 4648 §5 base64url, unpadded, as JWS and the
 * relay's grants spell a key or a tag inside a URL or a header.
 *
 *     import { base64urlEncode, base64urlDecode } from "nish/crypto/base64url";
 *
 *     const text: string = base64urlEncode(tag); // no `=` padding
 *     const back: u8[] | null = base64urlDecode(text); // null for any other spelling
 *
 * The alphabet is `A-Z a-z 0-9 - _`, and there is no `=`: the length of the
 * text already says how many bytes the last group holds (RFC 4648 §3.2 lets a
 * specification that knows its lengths drop the padding, and RFC 7515 §2 does).
 *
 * The module also holds RFC 4648 §4 standard base64 — `+` and `/`, padded with
 * `=` — as `base64StdPadEncode` and `base64StdPadDecode`, for PEM
 * (`nish/crypto/x509`) and SCRAM (`nish/net/postgres`), and as
 * `base64StdPadEncodeInto` and `base64StdPadDecodedLength`, which read and
 * write a caller's buffer and allocate nothing, for the WebSocket handshake
 * (`nish/net/websocket`). It is as strict and as
 * constant-time as the URL alphabet, by the same masks, and it refuses a `=`
 * anywhere but the last one or two characters of a text whose length is a
 * multiple of four. They are not `nish/base64`'s `base64Encode`, which encodes
 * only, indexes its alphabet and is for pixels; the `StdPad` names keep the two
 * apart in the program's one namespace.
 *
 * **Decoding is strict, so that each byte string has exactly one spelling.**
 * `base64urlDecode` answers `null` for a `=` anywhere, for any character outside
 * the alphabet (whitespace included), for a length of 1 mod 4 — six bits, not a
 * byte — for a final character whose unused low bits are not zero (RFC 4648
 * §3.5), and for a text longer than 2^31 - 1 bytes. A lenient decoder would let
 * `AB` and `AA` both mean `00`, and a token compared or cached by its text
 * would then have two identities.
 *
 * **Neither direction indexes or branches on the data.** What is encoded here
 * is usually a key, a nonce or a MAC, and a lookup table indexed by a secret
 * sextet leaves its trace in the cache. So a sextet becomes a character, and a
 * character a sextet, by arithmetic on range masks: `(lo - 1 - c) & (c - hi -
 * 1)` is negative exactly when `lo <= c <= hi`, and an arithmetic shift by 31
 * turns that sign into an all-ones or all-zeros mask.
 *
 *  A malformed character is not refused where it is found either: the verdict is
 *  ORed into one word and read once, after the whole text. The text's length is
 *  public and is tested first.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */

/**
 * All ones when `lo <= c <= hi`, else zero, without a branch. `c` is a byte or
 * a sextet, so neither subtraction could leave `i32`; they are written in
 * `u32`, which wraps by definition, because a signed one would be checked for
 * an overflow it cannot have, and the check is a branch on the secret. The
 * sign bit `>> 31` reads is the same either way. `base64urlCharOf` and
 * `base64urlSextetOf` do their sums in `u32` for the same reason.
 */
const base64urlRangeMask = (c: i32, lo: i32, hi: i32): i32 =>
  toI32((toU32(lo) - 1 - toU32(c)) & (toU32(c) - toU32(hi) - 1)) >> 31

/**
 * The URL-alphabet character for the sextet `v` (`0 <= v <= 63`).
 *
 * It starts from `'A' + v` and adds, for each range `v` has passed, the step
 * from the previous range's first character to this one's: 26 lands on `a`, 52
 * on `0`, 62 on `-` and 63 on `_`.
 */
const base64urlCharOf = (v: i32): i32 =>
  toI32(
    65 +
      toU32(v) +
      toU32(base64urlRangeMask(v, 26, 63) & 6) -
      toU32(base64urlRangeMask(v, 52, 63) & 75) -
      toU32(base64urlRangeMask(v, 62, 63) & 13) +
      toU32(base64urlRangeMask(v, 63, 63) & 49)
  )

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
    (upper & toI32(toU32(c) - 65)) |
    (lower & toI32(toU32(c) - 71)) |
    (digit & toI32(toU32(c) + 4)) |
    (dash & 62) |
    (underscore & 63)
  return value | ~(upper | lower | digit | dash | underscore)
}

/**
 * Writes `byte` to `out[at]` and answers `at + 1`. Every caller writes inside
 * an array it sized or checked for the text or bytes it puts there; the test
 * is the shape that proves the store, not a check a caller can fail.
 */
const base64Put = (out: u8[], at: i32, byte: u8): i32 => {
  if (at >= 0 && at < toI32(out.length)) {
    out[at] = byte
    return at + 1
  }
  return at
}

/**
 * `data` as unpadded base64url: four characters per three bytes, and two or
 * three for a short final group.
 *
 * Bytes go into a bit accumulator eight at a time and come out six at a time,
 * so one index walks the input and the only branches are on how many bits are
 * waiting — which depends on the position, never on the bytes. An array longer
 * than 2^31 - 1 bytes panics.
 *
 * @param data The bytes to encode; they are read, not changed.
 * @returns The unpadded base64url text, `ceil(4n / 3)` characters for `n`
 *   bytes.
 */
export const base64urlEncode = (data: u8[]): string => {
  // Refused before `toI32`, which saturates a longer length under
  // `--number-mode f64` and would end the loop at a prefix.
  if (data.length > 2147483647) {
    panic("base64urlEncode: more than 2^31 - 1 bytes")
  }
  const parts: string[] = []
  let acc: i32 = 0
  // Unsigned, so that counting bits in and out is never checked for an
  // overflow: it is never more than twelve.
  let bits: u32 = 0
  for (let k: i32 = 0; k < toI32(data.length); k++) {
    // At most four bits wait from the bytes before, so twelve are live here;
    // the mask keeps the accumulator from growing without bound.
    acc = ((acc << 8) | toI32(data[k])) & 0xfff
    bits += 8
    while (bits >= 6) {
      bits -= 6
      parts.push(String.fromCharCode(base64urlCharOf((acc >> toI32(bits)) & 63)))
    }
  }
  // Two or four bits of a final byte are left: they go out as the high bits of
  // one more sextet, filled out with zeros.
  if (bits > 0) {
    parts.push(String.fromCharCode(base64urlCharOf((acc << toI32(6 - bits)) & 63)))
  }
  return parts.join("")
}

/**
 * The bytes `text` spells in unpadded base64url, or `null` when it is not the
 * one canonical spelling of any byte string — see the module comment for the
 * five refusals.
 *
 * Each group of four characters becomes one 24-bit word, six bits a
 * character, which splits into three bytes; a short final group of two or
 * three characters fills the top of the word and gives one or two.
 *
 * @param text The unpadded base64url text, usually from a peer.
 * @returns A fresh array of the decoded bytes, or `null` when `text` is not the
 *   canonical spelling of any bytes.
 */
export const base64urlDecode = (text: string): u8[] | null => {
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
  // Both parts are `i32`s the bounds prover reads as non-negative, and their
  // sum, at most three quarters of `n`, as in range, so the allocation is
  // proven rather than checked.
  let short: i32 = 0
  if (tail > 1) {
    short = tail - 1
  }
  const whole: i32 = (n >> 2) * 3
  const out: u8[] = new Array<u8>(whole + short)
  // All ones once any character is outside the alphabet (a sextet of `-1`
  // shifted right by 31), and non-zero once the text ends on a bit that
  // encodes no byte.
  let bad: i32 = 0
  // Four characters make one 24-bit word and three bytes, so a full group has
  // no count of waiting bits to test, and its four sextets are independent.
  // `full` is where the short final group starts, `n` less its tail.
  //
  // Each read is written out here rather than in a helper: a function that
  // hands its `string` parameter to another is taken to keep it, and then a
  // caller decoding a string it built inside `using a = arena()` is refused.
  // The test on each position is the shape that proves the read, and depends
  // on the position alone; positions are `u32`s so that `k + 3` wraps rather
  // than overflows.
  const full: u32 = toU32(n & ~3)
  let j: i32 = 0
  for (let k: u32 = 0; k < full; k += 4) {
    const i0: i32 = toI32(k)
    const i1: i32 = toI32(k + 1)
    const i2: i32 = toI32(k + 2)
    const i3: i32 = toI32(k + 3)
    const s0: i32 = i0 >= 0 && i0 < n ? base64urlSextetOf(toI32(text.charCodeAt(i0))) : -1
    const s1: i32 = i1 >= 0 && i1 < n ? base64urlSextetOf(toI32(text.charCodeAt(i1))) : -1
    const s2: i32 = i2 >= 0 && i2 < n ? base64urlSextetOf(toI32(text.charCodeAt(i2))) : -1
    const s3: i32 = i3 >= 0 && i3 < n ? base64urlSextetOf(toI32(text.charCodeAt(i3))) : -1
    bad = bad | ((s0 | s1 | s2 | s3) >> 31)
    const word: i32 = ((s0 & 63) << 18) | ((s1 & 63) << 12) | ((s2 & 63) << 6) | (s3 & 63)
    j = base64Put(out, j, toU8(word >> 16))
    j = base64Put(out, j, toU8((word >> 8) & 255))
    j = base64Put(out, j, toU8(word & 255))
  }
  // A short final group of two or three characters: one or two bytes, and the
  // four or two bits left over belong to no byte, so they must be zero for `AA`
  // to be the only spelling of a zero byte and `AB` refused (RFC 4648 §3.5).
  if (tail !== 0) {
    const i0: i32 = toI32(full)
    const i1: i32 = toI32(full + 1)
    const i2: i32 = toI32(full + 2)
    const s0: i32 = i0 >= 0 && i0 < n ? base64urlSextetOf(toI32(text.charCodeAt(i0))) : -1
    const s1: i32 = i1 >= 0 && i1 < n ? base64urlSextetOf(toI32(text.charCodeAt(i1))) : -1
    // A third character only when the tail has one; a two-character tail reads
    // its place as `A`, the zero sextet, which adds no bits.
    const s2: i32 = tail === 3 && i2 >= 0 && i2 < n ? base64urlSextetOf(toI32(text.charCodeAt(i2))) : 0
    bad = bad | ((s0 | s1 | s2) >> 31)
    const word: i32 = ((s0 & 63) << 18) | ((s1 & 63) << 12) | ((s2 & 63) << 6)
    j = base64Put(out, j, toU8(word >> 16))
    if (tail === 3) {
      base64Put(out, j, toU8((word >> 8) & 255))
    }
    // The bits under the last byte written: sixteen of the word when one byte
    // was, eight when two were.
    bad = bad | (word & (tail === 2 ? 0xffff : 0xff))
  }
  if (bad !== 0) {
    return null
  }
  return out
}

// ---------------------------------------------------------------------------
// Standard base64 (RFC 4648 §4): `+` and `/`, padded with `=`
// ---------------------------------------------------------------------------

/**
 * The standard-alphabet character for the sextet `v`: the same steps as
 * `base64urlCharOf` until 62, which lands on `+` and 63 on `/`.
 */
const base64StdPadCharOf = (v: i32): i32 =>
  toI32(
    65 +
      toU32(v) +
      toU32(base64urlRangeMask(v, 26, 63) & 6) -
      toU32(base64urlRangeMask(v, 52, 63) & 75) -
      toU32(base64urlRangeMask(v, 62, 63) & 15) +
      toU32(base64urlRangeMask(v, 63, 63) & 3)
  )

/** The sextet the byte `c` stands for in standard base64, or `-1` when it is not in the alphabet. */
const base64StdPadSextetOf = (c: i32): i32 => {
  const upper: i32 = base64urlRangeMask(c, 65, 90)
  const lower: i32 = base64urlRangeMask(c, 97, 122)
  const digit: i32 = base64urlRangeMask(c, 48, 57)
  const plus: i32 = base64urlRangeMask(c, 43, 43)
  const slash: i32 = base64urlRangeMask(c, 47, 47)
  const value: i32 =
    (upper & toI32(toU32(c) - 65)) |
    (lower & toI32(toU32(c) - 71)) |
    (digit & toI32(toU32(c) + 4)) |
    (plus & 62) |
    (slash & 63)
  return value | ~(upper | lower | digit | plus | slash)
}

/**
 * `data` in padded standard base64, as one line: PEM's body, and SCRAM's
 * nonces, salts and proofs (RFC 5802 §5.1). One `=` closes a final group of
 * two bytes, two a group of one. An array longer than 2^31 - 1 bytes panics.
 *
 * @param data The bytes to encode; they are read, not changed.
 * @returns The padded standard base64 text, `4 × ceil(n / 3)` characters for
 *   `n` bytes, with no line breaks.
 */
export const base64StdPadEncode = (data: u8[]): string => {
  if (data.length > 2147483647) {
    panic("base64StdPadEncode: more than 2^31 - 1 bytes")
  }
  const parts: string[] = []
  let acc: i32 = 0
  let bits: u32 = 0
  for (let k: i32 = 0; k < toI32(data.length); k++) {
    acc = ((acc << 8) | toI32(data[k])) & 0xfff
    bits += 8
    while (bits >= 6) {
      bits -= 6
      parts.push(String.fromCharCode(base64StdPadCharOf((acc >> toI32(bits)) & 63)))
    }
  }
  if (bits > 0) {
    parts.push(String.fromCharCode(base64StdPadCharOf((acc << toI32(6 - bits)) & 63)))
  }
  const tail: i32 = toI32(data.length) % 3
  if (tail > 0) {
    parts.push(tail === 1 ? "==" : "=")
  }
  return parts.join("")
}

/**
 * `base64StdPadEncode` of `data[start .. start + length)`, written into `out`
 * from `at` as the bytes of its characters, allocating nothing: the WebSocket
 * accept key that a server writes for every handshake (RFC 6455 §4.2.2). A
 * range outside `data`, or text that does not fit in `out` from `at`, panics.
 *
 * @param data The buffer holding the bytes to encode; it is read, not changed.
 * @param start Where in `data` the bytes start.
 * @param length How many bytes to encode.
 * @param out The buffer the text is written into.
 * @param at Where in `out` the text starts.
 * @returns The index in `out` just past the text, `at + 4 × ceil(length / 3)`.
 */
export const base64StdPadEncodeInto = (data: u8[], start: i32, length: i32, out: u8[], at: i32): i32 => {
  if (data.length > 2147483647 || out.length > 2147483647) {
    panic("base64StdPadEncodeInto: a buffer longer than 2^31 - 1 bytes")
  }
  if (start < 0 || length < 0 || start > toI32(data.length) - length || length > 1610612733) {
    panic("base64StdPadEncodeInto: bytes outside their buffer")
  }
  // The text's length, and the room after `at`, as `u32`s: exact, since
  // `length` is at most 1610612733 and `at` at most `out.length`.
  const textLength: u32 = ((toU32(length) + 2) / 3) * 4
  if (at < 0 || at > toI32(out.length) || textLength > toU32(toI32(out.length)) - toU32(at)) {
    panic("base64StdPadEncodeInto: text that does not fit its buffer")
  }
  const end: i32 = toI32(toU32(at) + textLength)
  // `k` runs through `data[start .. start + length)` and `j` through the text;
  // the bounds on them only let the prover see what the tests above checked.
  let j: i32 = at
  let k: i32 = start
  let acc: i32 = 0
  let bits: u32 = 0
  for (let n: i32 = 0; n < length && k >= 0 && k < toI32(data.length); n++) {
    acc = ((acc << 8) | toI32(data[k])) & 0xfff
    k += 1
    bits += 8
    while (bits >= 6) {
      bits -= 6
      j = base64Put(out, j, toU8(base64StdPadCharOf((acc >> toI32(bits)) & 63)))
    }
  }
  if (bits > 0) {
    j = base64Put(out, j, toU8(base64StdPadCharOf((acc << toI32(6 - bits)) & 63)))
  }
  while (j >= 0 && j < end && j < toI32(out.length)) {
    out[j] = 61
    j += 1
  }
  return end
}

/**
 * How many bytes the padded standard base64 in `text[start .. start + length)`
 * decodes to, or -1 unless it is their one canonical spelling, by
 * `base64StdPadDecode`'s rules and its masks; nothing is decoded or allocated.
 * A WebSocket server checks a handshake's `Sec-WebSocket-Key` this way, where
 * it lies in the request (RFC 6455 §4.2.1, item 5). A range outside `text`
 * panics.
 *
 * @param text The buffer holding the text, one character a byte.
 * @param start Where in `text` the base64 starts.
 * @param length How many characters it is.
 * @returns The decoded length, or -1 when the text is not canonical.
 */
export const base64StdPadDecodedLength = (text: u8[], start: i32, length: i32): i32 => {
  if (text.length > 2147483647) {
    panic("base64StdPadDecodedLength: a buffer longer than 2^31 - 1 bytes")
  }
  if (start < 0 || length < 0 || start > toI32(text.length) - length) {
    panic("base64StdPadDecodedLength: text outside its buffer")
  }
  if ((length & 3) !== 0) {
    return -1
  }
  // The text's last character, a `u32` sum that is exact once the range is
  // inside `text`; a length that is a multiple of four and not 0 is at least 4,
  // so the character before it is in the range too.
  const last: i32 = toI32(toU32(start) + toU32(length) - 1)
  let pad: u32 = 0
  if (length > 0 && last >= 1 && last < toI32(text.length) && toI32(text[last]) === 61) {
    pad = toI32(text[last - 1]) === 61 ? 2 : 1
  }
  const chars: i32 = toI32(toU32(length) - pad)
  let bad: i32 = 0
  let acc: i32 = 0
  let bits: u32 = 0
  let p: i32 = start
  for (let k: i32 = 0; k < chars && p >= 0 && p < toI32(text.length); k++) {
    const v: i32 = base64StdPadSextetOf(toI32(text[p]))
    p += 1
    bad = bad | (v >> 31)
    acc = ((acc << 6) | (v & 63)) & 0xfff
    bits += 6
    if (bits >= 8) {
      bits -= 8
    }
  }
  bad = bad | (acc & toI32((toU32(1) << bits) - 1))
  if (bad !== 0) {
    return -1
  }
  return toI32(toU32(length >> 2) * 3 - pad)
}

/**
 * The bytes of padded standard base64 `text`, or `null` unless it is the one
 * canonical spelling of them: a whole number of four-character groups, `=`
 * only as the last one or two characters, every other character in the
 * alphabet, and the bits the padding leaves over all zero (RFC 4648 §3.5).
 * The empty text is the spelling of no bytes (RFC 4648 §10). Where the padding
 * is depends on the length alone; the characters themselves are read by masks
 * and judged once, after the last.
 *
 * @param text The padded standard base64 text, with no line breaks or
 *   whitespace.
 * @returns A fresh array of the decoded bytes, or `null` when `text` is not
 *   their canonical padded spelling.
 */
export const base64StdPadDecode = (text: string): u8[] | null => {
  if (text.length > 2147483647) {
    return null
  }
  const n: i32 = toI32(text.length)
  if ((n & 3) !== 0) {
    return null
  }
  // The empty text spells no bytes; any other length that is a multiple of
  // four is at least 4.
  if (n < 4) {
    return new Array<u8>(0)
  }
  let pad: u32 = 0
  if (toI32(text.charCodeAt(n - 1)) === 61) {
    pad = toI32(text.charCodeAt(n - 2)) === 61 ? 2 : 1
  }
  // Three bytes per group before the last, and three less the padding in the
  // last: two `i32`s the bounds prover reads as non-negative, so the
  // allocation is proven rather than checked.
  let last: i32 = 3
  if (pad === 1) {
    last = 2
  }
  if (pad === 2) {
    last = 1
  }
  const whole: i32 = ((n >> 2) - 1) * 3
  const out: u8[] = new Array<u8>(whole + last)
  const chars: i32 = toI32(toU32(n) - pad)
  let bad: i32 = 0
  let acc: i32 = 0
  let bits: u32 = 0
  let j: i32 = 0
  // The padding is past `chars` and is not data; which positions those are is
  // a fact about the length. A `=` before them is outside the alphabet.
  for (let k: i32 = 0; k < chars && k < toI32(text.length); k++) {
    const v: i32 = base64StdPadSextetOf(toI32(text.charCodeAt(k)))
    bad = bad | (v >> 31)
    acc = ((acc << 6) | (v & 63)) & 0xfff
    bits += 6
    if (bits >= 8) {
      bits -= 8
      j = base64Put(out, j, toU8((acc >> toI32(bits)) & 255))
    }
  }
  bad = bad | (acc & toI32((toU32(1) << bits) - 1))
  if (bad !== 0) {
    return null
  }
  return out
}

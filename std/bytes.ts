/**
 * `std/bytes` — fixed-width integers and doubles read from, and written into,
 * a byte array at an offset, in either byte order.
 *
 * A wire format, a file header or a hash's message schedule is a `u8[]` with
 * numbers laid out in it, and every reader of one writes the same four-line
 * shift-and-or. This module is that loop written once:
 *
 *     import { getU32BE, setU16LE } from "nish/bytes";
 *
 *     const header: u8[] = [0, 0, 1, 0, 0, 0];
 *     const length = getU32BE(header, 0); // 256
 *     setU16LE(header, 4, toU16(513)); // header[4] = 1, header[5] = 2
 *
 * Every function takes the array and the offset of its first byte; the `LE`
 * name puts the least significant byte there, the `BE` name the most
 * significant. The widths are `u16`, `u32` and `u64`, the signed `i32` and
 * `i64`, which are the same bytes read as two's complement, and `f64`, whose
 * bytes are its IEEE 754 bits (`f64ToBits`). There is no `f32`: the language
 * has no bit cast for one.
 *
 * Each access is an ordinary index, so an offset whose bytes do not all lie in
 * the array panics `index`, naming the first byte that does not. A guard in
 * the caller does not yet remove these checks: in a loop guarded by
 * `off + 3 < b.length`, the checker proves an index it can see but not one
 * inside a call, and after `getU32LE` inlines, LLVM keeps the checks on
 * `off + 1` to `off + 3`, because the guard compares the length truncated to
 * `i32` and the checks compare it unsigned at 64 bits. A loop that needs them
 * gone indexes the bytes itself.
 *
 * The in-range answers are byte for byte those of the copies `std/` keeps for
 * itself: `sha256LoadWord` (`std/crypto/sha256.ts`) for `getU32BE`,
 * `chacha20Word` and `poly1305Le64` (`std/crypto/chacha20poly1305.ts`) for
 * `getU32LE` and `getU64LE`, `loadWord` and `storeWord` (`std/crypto/sha512.ts`)
 * for `getU64BE` and `setU64BE`, `http2FramePut32` (`std/net/http2-frame.ts`)
 * for `setU32BE`, and `tlsPutU16` (`std/net/tls/codec.ts`) for `setU16BE`. None
 * of them is replaced by this module. Out of range they differ: the AES and
 * TLS word helpers read zero past the end and drop bytes written there, which
 * their callers rely on, where this module panics.
 *
 * Under Node (`docs/RUN_UNDER_NODE.md`) the `u16` and `u32` functions are
 * expected to answer as they do natively, because the top byte of a `u32` is
 * multiplied in rather than shifted and each byte written is masked before
 * its `toU8`: there `<<` turns bit 31 into a sign and the prelude's `toU8`
 * and `toU32` saturate, and natively the multiply and the mask fold into the
 * shift and the truncation. The others do not yet answer there: the `i32`
 * functions cross between signed and unsigned with `toI32` and `toU32`, which
 * the prelude saturates too (`setI32LE(b, 0, -2)` writes zeros), and the
 * 64-bit functions and `f64` meet its BigInt `u64` and `i64`, which `toU8`
 * refuses.
 *
 * The module also has the runs a parser walks and the copy it makes of them.
 * `skipBlank`, `skipDigits` and `skipJsonText` each answer the first index in
 * a range whose byte is not in their class — JSON's blanks, the ASCII digits,
 * the bytes a JSON string holds as themselves — and `copyBytes` copies a
 * window of one array into another, or into itself, as one move:
 *
 *     const text: u8[] = [32, 32, 52, 50, 44]; // "  42,"
 *     const start = skipBlank(text, 0, 5); // 2
 *     const end = skipDigits(text, start, 5); // 4
 *
 * The three runs clamp their range and never panic; `copyBytes` panics on a
 * range outside its array. Natively each is a runtime kernel
 * (docs/LANGUAGE.md, "Byte runs"), and the runs are variable-time: they are
 * for text, never for secret data.
 */

/** The `u16` whose low byte is `b[off]` and high byte `b[off + 1]`. */
export const getU16LE = (b: u8[], off: i32): u16 => toU16(b[off]) | (toU16(b[off + 1]) << 8)

/** The `u16` whose high byte is `b[off]` and low byte `b[off + 1]`. */
export const getU16BE = (b: u8[], off: i32): u16 => (toU16(b[off]) << 8) | toU16(b[off + 1])

/** The `u32` whose bytes, least significant first, are `b[off]` to `b[off + 3]`. */
export const getU32LE = (b: u8[], off: i32): u32 =>
  (toU32(b[off]) | (toU32(b[off + 1]) << 8) | (toU32(b[off + 2]) << 16)) +
  toU32(b[off + 3]) * toU32(0x1000000)

/** The `u32` whose bytes, most significant first, are `b[off]` to `b[off + 3]`. */
export const getU32BE = (b: u8[], off: i32): u32 =>
  toU32(b[off]) * toU32(0x1000000) +
  ((toU32(b[off + 1]) << 16) | (toU32(b[off + 2]) << 8) | toU32(b[off + 3]))

/** The `u64` whose bytes, least significant first, are `b[off]` to `b[off + 7]`. */
export const getU64LE = (b: u8[], off: i32): u64 => {
  let v = toU64(0)
  for (let i: i32 = 0; i < 8; i++) {
    v = v | (toU64(b[off + i]) << toU64(i * 8))
  }
  return v
}

/** The `u64` whose bytes, most significant first, are `b[off]` to `b[off + 7]`. */
export const getU64BE = (b: u8[], off: i32): u64 => {
  let v = toU64(0)
  for (let i: i32 = 0; i < 8; i++) {
    v = (v << toU64(8)) | toU64(b[off + i])
  }
  return v
}

/** `getU32LE`'s bits as a two's-complement `i32`. */
export const getI32LE = (b: u8[], off: i32): i32 => toI32(getU32LE(b, off))

/** `getU32BE`'s bits as a two's-complement `i32`. */
export const getI32BE = (b: u8[], off: i32): i32 => toI32(getU32BE(b, off))

/** `getU64LE`'s bits as a two's-complement `i64`. */
export const getI64LE = (b: u8[], off: i32): i64 => toI64(getU64LE(b, off))

/** `getU64BE`'s bits as a two's-complement `i64`. */
export const getI64BE = (b: u8[], off: i32): i64 => toI64(getU64BE(b, off))

/** The `f64` whose IEEE 754 bits are `getU64LE`'s. */
export const getF64LE = (b: u8[], off: i32): f64 => bitsToF64(toI64(getU64LE(b, off)))

/** The `f64` whose IEEE 754 bits are `getU64BE`'s. */
export const getF64BE = (b: u8[], off: i32): f64 => bitsToF64(toI64(getU64BE(b, off)))

/** Writes `v` into `b[off]` and `b[off + 1]`, low byte first. */
export const setU16LE = (b: u8[], off: i32, v: u16): void => {
  b[off] = toU8(v & 255)
  b[off + 1] = toU8((v >> 8) & 255)
}

/** Writes `v` into `b[off]` and `b[off + 1]`, high byte first. */
export const setU16BE = (b: u8[], off: i32, v: u16): void => {
  b[off] = toU8((v >> 8) & 255)
  b[off + 1] = toU8(v & 255)
}

/** Writes `v` into `b[off]` to `b[off + 3]`, least significant byte first. */
export const setU32LE = (b: u8[], off: i32, v: u32): void => {
  b[off] = toU8(v & 255)
  b[off + 1] = toU8((v >> 8) & 255)
  b[off + 2] = toU8((v >> 16) & 255)
  b[off + 3] = toU8((v >> 24) & 255)
}

/** Writes `v` into `b[off]` to `b[off + 3]`, most significant byte first. */
export const setU32BE = (b: u8[], off: i32, v: u32): void => {
  b[off] = toU8((v >> 24) & 255)
  b[off + 1] = toU8((v >> 16) & 255)
  b[off + 2] = toU8((v >> 8) & 255)
  b[off + 3] = toU8(v & 255)
}

/** Writes `v` into `b[off]` to `b[off + 7]`, least significant byte first. */
export const setU64LE = (b: u8[], off: i32, v: u64): void => {
  for (let i: i32 = 0; i < 8; i++) {
    b[off + i] = toU8((v >> toU64(i * 8)) & toU64(255))
  }
}

/** Writes `v` into `b[off]` to `b[off + 7]`, most significant byte first. */
export const setU64BE = (b: u8[], off: i32, v: u64): void => {
  for (let i: i32 = 0; i < 8; i++) {
    b[off + i] = toU8((v >> toU64((7 - i) * 8)) & toU64(255))
  }
}

/** Writes `v`'s two's-complement bits as `setU32LE` does. */
export const setI32LE = (b: u8[], off: i32, v: i32): void => setU32LE(b, off, toU32(v))

/** Writes `v`'s two's-complement bits as `setU32BE` does. */
export const setI32BE = (b: u8[], off: i32, v: i32): void => setU32BE(b, off, toU32(v))

/** Writes `v`'s two's-complement bits as `setU64LE` does. */
export const setI64LE = (b: u8[], off: i32, v: i64): void => setU64LE(b, off, toU64(v))

/** Writes `v`'s two's-complement bits as `setU64BE` does. */
export const setI64BE = (b: u8[], off: i32, v: i64): void => setU64BE(b, off, toU64(v))

/** Writes `v`'s IEEE 754 bits as `setU64LE` does. */
export const setF64LE = (b: u8[], off: i32, v: f64): void => setU64LE(b, off, toU64(f64ToBits(v)))

/** Writes `v`'s IEEE 754 bits as `setU64BE` does. */
export const setF64BE = (b: u8[], off: i32, v: f64): void => setU64BE(b, off, toU64(f64ToBits(v)))

// ---- Byte-class runs and the byte copy (WP38 S6a) ----------------------------------------

/** JSON's four blanks (RFC 8259 §2): space, tab, newline and carriage return. */
const BYTES_SPACE: i32 = 32
const BYTES_TAB: i32 = 9
const BYTES_NEWLINE: i32 = 10
const BYTES_CARRIAGE_RETURN: i32 = 13
/** `0` and `9`. */
const BYTES_DIGIT_ZERO: i32 = 48
const BYTES_DIGIT_NINE: i32 = 57
/** The two printable ASCII bytes a JSON string escapes, `"` and `\`. */
const BYTES_QUOTE: i32 = 34
const BYTES_BACKSLASH: i32 = 92
/** The first byte that is not ASCII, and the continuation bytes' range. */
const BYTES_NON_ASCII: i32 = 128
const BYTES_CONTINUATION_TOP: i32 = 191

/** `to` clamped into `[0, b.length]`: where a run's scan stops. */
const bytesRunEnd = (b: u8[], to: i32): i32 => {
  const n: i32 = toI32(b.length)
  if (to < 0) {
    return 0
  }
  return to < n ? to : n
}

/** `from` clamped into `[0, end]`: where a run's scan starts. */
const bytesRunStart = (from: i32, end: i32): i32 => {
  if (from < 0) {
    return 0
  }
  return from < end ? from : end
}

/**
 * The first index in `[from, to)` whose byte is not one of JSON's blanks —
 * space, tab, newline, carriage return — or `to` when every byte there is
 * one. `to` is clamped to `[0, b.length]` and `from` to `[0, to]`, as
 * `indexOfAny` clamps, so no range panics: one past the end answers the end.
 *
 * Natively the scan is the runtime's `nish_bytes_skip_blank`, which reads 16
 * or 32 bytes at a time (docs/LANGUAGE.md, "Byte runs"). It is
 * **variable-time**: how long it takes says how long the run is, so it is
 * never for secret data.
 */
export const skipBlank = (b: u8[], from: i32, to: i32): i32 => {
  const end: i32 = bytesRunEnd(b, to)
  return skipBlankWalk(b, bytesRunStart(from, end), end)
}

/** `skipBlank` for the ASCII digits `0` to `9`: the same clamps, the same kernel family, `nish_bytes_skip_digits`. */
export const skipDigits = (b: u8[], from: i32, to: i32): i32 => {
  const end: i32 = bytesRunEnd(b, to)
  return skipDigitsWalk(b, bytesRunStart(from, end), end)
}

/**
 * `skipBlank` for the bytes a JSON string holds as themselves: printable ASCII
 * other than `"` and `\`, and every well-formed UTF-8 sequence (RFC 3629 §4)
 * that ends before `to`. The run stops at the first quote, backslash or
 * control byte, and at the lead byte of a sequence that is malformed — an
 * overlong form, a surrogate, a code point past U+10FFFF, a stray continuation
 * byte — or cut short by `to`. So a whole JSON string body with no escape is
 * one call, and where it stops is the byte a decoder has to look at. Natively
 * the scan is `nish_bytes_skip_json_text`: blocks of ASCII 16 or 32 bytes at a
 * time, each multi-byte sequence a byte at a time. Variable-time, as
 * `skipBlank` is.
 */
export const skipJsonText = (b: u8[], from: i32, to: i32): i32 => {
  const end: i32 = bytesRunEnd(b, to)
  return skipJsonTextWalk(b, bytesRunStart(from, end), end)
}

/**
 * `count` bytes of `src` from `from` written over `dst` from `at`, as one
 * copy: where `dst` and `src` are one array and the two ranges overlap, the
 * bytes land as if every one were read before any was written, as
 * `copyWithin` promises. Where `dst.set(src, at)` copies all of `src`, this
 * copies a window of it, and allocates nothing.
 *
 * A negative `count`, or a range that does not lie inside its array —
 * `0 <= from <= from + count <= src.length` and the same for `at` in `dst` —
 * panics `copyBytes` before any byte is written. Natively the copy is one
 * `llvm.memmove`.
 */
export const copyBytes = (dst: u8[], at: i32, src: u8[], from: i32, count: i32): void => {
  if (count < 0 || at < 0 || from < 0 || at > toI32(dst.length) - count || from > toI32(src.length) - count) {
    panic("copyBytes: the range lies outside an array")
  }
  copyBytesWalk(dst, at, src, from, count)
}

/**
 * `skipBlank`'s walk, once its range is clamped. This loop and the three
 * below are what run under Node; natively the compiler replaces the one call
 * each public function makes with the runtime kernel (`src/kernels.ts`), as it
 * does `indexOfAny`'s walk, so each loop is its kernel's meaning written in
 * the language. The `i < b.length` test never fails after the clamp; it is
 * written because it is what proves the index.
 */
const skipBlankWalk = (b: u8[], from: i32, to: i32): i32 => {
  let i: i32 = from
  while (i >= 0 && i < to && i < toI32(b.length)) {
    const c: i32 = toI32(b[i])
    if (c !== BYTES_SPACE && c !== BYTES_TAB && c !== BYTES_NEWLINE && c !== BYTES_CARRIAGE_RETURN) {
      return i
    }
    i += 1
  }
  return i
}

/** `skipDigits`'s walk, once its range is clamped. */
const skipDigitsWalk = (b: u8[], from: i32, to: i32): i32 => {
  let i: i32 = from
  while (i >= 0 && i < to && i < toI32(b.length)) {
    const c: i32 = toI32(b[i])
    if (c < BYTES_DIGIT_ZERO || c > BYTES_DIGIT_NINE) {
      return i
    }
    i += 1
  }
  return i
}

/**
 * The length of the well-formed UTF-8 sequence whose lead byte is `b[i]` and
 * that ends at or before `to`, or 0: RFC 3629's table, with the narrowed
 * second byte after `E0`, `ED`, `F0` and `F4`.
 */
const bytesUtf8Length = (b: u8[], i: i32, to: i32): i32 => {
  const lead: i32 = toI32(b[i])
  let low: i32 = BYTES_NON_ASCII
  let high: i32 = BYTES_CONTINUATION_TOP
  let n: i32 = 0
  if (lead >= 0xc2 && lead <= 0xdf) {
    n = 2
  } else if (lead >= 0xe0 && lead <= 0xef) {
    n = 3
    if (lead === 0xe0) {
      low = 0xa0
    }
    if (lead === 0xed) {
      high = 0x9f
    }
  } else if (lead >= 0xf0 && lead <= 0xf4) {
    n = 4
    if (lead === 0xf0) {
      low = 0x90
    }
    if (lead === 0xf4) {
      high = 0x8f
    }
  } else {
    return 0
  }
  if (to - i < n) {
    return 0
  }
  const second: i32 = toI32(b[i + 1])
  if (second < low || second > high) {
    return 0
  }
  let k: i32 = 2
  while (k < n) {
    const c: i32 = toI32(b[i + k])
    if (c < BYTES_NON_ASCII || c > BYTES_CONTINUATION_TOP) {
      return 0
    }
    k += 1
  }
  return n
}

/** `skipJsonText`'s walk, once its range is clamped. */
const skipJsonTextWalk = (b: u8[], from: i32, to: i32): i32 => {
  let i: i32 = from
  while (i >= 0 && i < to && i < toI32(b.length)) {
    const c: i32 = toI32(b[i])
    if (c >= BYTES_NON_ASCII) {
      const n: i32 = bytesUtf8Length(b, i, to)
      if (n === 0) {
        return i
      }
      i += n
      continue
    }
    if (c < BYTES_SPACE || c === BYTES_QUOTE || c === BYTES_BACKSLASH) {
      return i
    }
    i += 1
  }
  return i
}

/** `copyBytes`'s walk, once its ranges are checked: forward, or backward when `dst` is `src` and the bytes move up. */
const copyBytesWalk = (dst: u8[], at: i32, src: u8[], from: i32, count: i32): void => {
  if (at <= from) {
    let k: i32 = 0
    while (k < count) {
      dst[at + k] = src[from + k]
      k += 1
    }
    return
  }
  let k: i32 = count - 1
  while (k >= 0) {
    dst[at + k] = src[from + k]
    k -= 1
  }
}

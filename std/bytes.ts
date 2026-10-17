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

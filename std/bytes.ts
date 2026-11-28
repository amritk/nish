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
 *     export const main = (): i32 => {
 *       const header: u8[] = [0, 0, 1, 0, 0, 0];
 *       const length = getU32BE(header, 0); // 256
 *       setU16LE(header, 4, toU16(513)); // header[4] = 1, header[5] = 2
 *       return toI32(length);
 *     };
 *
 * **Every function takes the array and the offset of its first byte; the `LE`
 * name puts the least significant byte there, the `BE` name the most
 * significant.** The widths are `u16`, `u32` and `u64`, the signed `i32` and
 * `i64`, which are the same bytes read as two's complement, and `f64`, whose
 * bytes are its IEEE 754 bits (`f64ToBits`). There is no `f32`: the language
 * has no bit cast for one.
 *
 * **Each function checks its whole window once, first, through `bytesWindow`**,
 * so an offset whose bytes do not all lie in the array panics before any byte
 * is read or written, naming the function, the offset and the array's length.
 * The check is a window contract (docs/LANGUAGE.md, "Panic sites", `window`):
 * it is recorded at each call, so a caller whose own test holds the window,
 * such as `off >= 0 && off + 4 <= b.length` before a `getU32LE`, proves it
 * there, and a `--deny-panics` program that tests its offsets needs no
 * opt-out. Inside, every byte the window covers is proven, so the eight-byte
 * reads lower to one load (and, big-endian, a byte swap).
 *
 * **The in-range answers are byte for byte those of the copies `std/` keeps for
 * itself**: `sha256LoadWord` (`std/crypto/sha256.ts`) for `getU32BE`,
 * `chacha20Word` and `poly1305Le64` (`std/crypto/chacha20poly1305.ts`) for
 * `getU32LE` and `getU64LE`, `loadWord` and `storeWord` (`std/crypto/sha512.ts`)
 * for `getU64BE` and `setU64BE`, `http2FramePut32` (`std/net/http2-frame.ts`)
 * for `setU32BE`, and `tlsPutU16` (`std/net/tls/codec.ts`) for `setU16BE`. None
 * of them is replaced by this module. Out of range they differ: the AES and
 * TLS word helpers read zero past the end and drop bytes written there, which
 * their callers rely on, where this module panics.
 *
 * **Under Node (`docs/RUN_UNDER_NODE.md`) the `u16` and `u32` functions are
 * expected to answer as they do natively**, because the top byte of a `u32` is
 * multiplied in rather than shifted and each byte written is masked before
 * its `toU8`: there `<<` turns bit 31 into a sign and the prelude's `toU8`
 * and `toU32` saturate, and natively the multiply and the mask fold into the
 * shift and the truncation. The others do not yet answer there: the `i32`
 * functions cross between signed and unsigned with `toI32` and `toU32`, which
 * the prelude saturates too (`setI32LE(b, 0, -2)` writes zeros), and the
 * 64-bit functions and `f64` meet its BigInt `u64` and `i64`, which `toU8`
 * refuses.
 *
 * **The module also has the runs a parser walks and the copy it makes of
 * them.**
 * `skipBlank`, `skipDigits`, `skipJsonText` and `skipJsonPlain` each answer
 * the first index in a range whose byte is not in their class — JSON's blanks,
 * the ASCII digits, the bytes a JSON string holds as themselves, the bytes a
 * JSON writer copies without an escape — and `copyBytes` copies a
 * window of one array into another, or into itself, as one move:
 *
 *     import { skipBlank, skipDigits } from "nish/bytes";
 *
 *     export const main = (): i32 => {
 *       const text: u8[] = [32, 32, 52, 50, 44]; // "  42,"
 *       const start = skipBlank(text, 0, 5); // 2
 *       const end = skipDigits(text, start, 5); // 4
 *       return end - start;
 *     };
 *
 * **The four runs clamp their range and never panic; `copyBytes` panics on a
 * range outside its array.** Natively each is a runtime kernel
 * (docs/LANGUAGE.md, "Byte runs"), and the runs are variable-time: they are
 * for text, never for secret data.
 */

/**
 * The window guard every fixed-width read and write calls first: it returns
 * exactly when `b[off]` to `b[off + len - 1]` all lie in `b`, and panics,
 * naming `what`, otherwise. Its shape is the `window` contract's
 * (docs/LANGUAGE.md, "Panic sites"), so each function that calls it first
 * forwards the check to its own callers.
 */
const bytesWindow = (what: string, b: readonly u8[], off: i32, len: i32): void => {
  const size: i32 = toI32(b.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(`${what}: the ${len} bytes at ${off} do not all lie in an array of ${size}`)
  }
}

/**
 * The `u16` whose low byte is `b[off]` and high byte `b[off + 1]`.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 1]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @returns The number read.
 */
export const getU16LE = (b: u8[], off: i32): u16 => {
  bytesWindow("getU16LE", b, off, 2)
  return toU16(b[off]) | (toU16(b[off + 1]) << 8)
}

/**
 * The `u16` whose high byte is `b[off]` and low byte `b[off + 1]`.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 1]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @returns The number read.
 */
export const getU16BE = (b: u8[], off: i32): u16 => {
  bytesWindow("getU16BE", b, off, 2)
  return (toU16(b[off]) << 8) | toU16(b[off + 1])
}

/**
 * The `u32` whose bytes, least significant first, are `b[off]` to `b[off + 3]`.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 3]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @returns The number read.
 */
export const getU32LE = (b: u8[], off: i32): u32 => {
  bytesWindow("getU32LE", b, off, 4)
  return (
    (toU32(b[off]) | (toU32(b[off + 1]) << 8) | (toU32(b[off + 2]) << 16)) +
    toU32(b[off + 3]) * toU32(0x1000000)
  )
}

/**
 * The `u32` whose bytes, most significant first, are `b[off]` to `b[off + 3]`.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 3]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @returns The number read.
 */
export const getU32BE = (b: u8[], off: i32): u32 => {
  bytesWindow("getU32BE", b, off, 4)
  return (
    toU32(b[off]) * toU32(0x1000000) +
    ((toU32(b[off + 1]) << 16) | (toU32(b[off + 2]) << 8) | toU32(b[off + 3]))
  )
}

/**
 * The `u64` whose bytes, least significant first, are `b[off]` to `b[off + 7]`.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 7]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @returns The number read.
 */
export const getU64LE = (b: u8[], off: i32): u64 => {
  bytesWindow("getU64LE", b, off, 8)
  return (
    toU64(b[off]) |
    (toU64(b[off + 1]) << toU64(8)) |
    ((toU64(b[off + 2]) << toU64(16)) | (toU64(b[off + 3]) << toU64(24))) |
    ((toU64(b[off + 4]) << toU64(32)) |
      (toU64(b[off + 5]) << toU64(40)) |
      ((toU64(b[off + 6]) << toU64(48)) | (toU64(b[off + 7]) << toU64(56))))
  )
}

/**
 * The `u64` whose bytes, most significant first, are `b[off]` to `b[off + 7]`.
 * The ors are grouped in pairs, which LLVM folds into one load and a `bswap`;
 * a flat chain of eight `or`s stayed byte by byte.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 7]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @returns The number read.
 */
export const getU64BE = (b: u8[], off: i32): u64 => {
  bytesWindow("getU64BE", b, off, 8)
  return (
    (toU64(b[off]) << toU64(56)) |
    (toU64(b[off + 1]) << toU64(48)) |
    ((toU64(b[off + 2]) << toU64(40)) | (toU64(b[off + 3]) << toU64(32))) |
    ((toU64(b[off + 4]) << toU64(24)) |
      (toU64(b[off + 5]) << toU64(16)) |
      ((toU64(b[off + 6]) << toU64(8)) | toU64(b[off + 7])))
  )
}

/**
 * `getU32LE`'s bits as a two's-complement `i32`.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 3]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @returns The number read, from -2^31 to 2^31 - 1.
 */
export const getI32LE = (b: u8[], off: i32): i32 => {
  bytesWindow("getI32LE", b, off, 4)
  return toI32(getU32LE(b, off))
}

/**
 * `getU32BE`'s bits as a two's-complement `i32`.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 3]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @returns The number read, from -2^31 to 2^31 - 1.
 */
export const getI32BE = (b: u8[], off: i32): i32 => {
  bytesWindow("getI32BE", b, off, 4)
  return toI32(getU32BE(b, off))
}

/**
 * `getU64LE`'s bits as a two's-complement `i64`.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 7]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @returns The number read, from -2^63 to 2^63 - 1.
 */
export const getI64LE = (b: u8[], off: i32): i64 => {
  bytesWindow("getI64LE", b, off, 8)
  return toI64(getU64LE(b, off))
}

/**
 * `getU64BE`'s bits as a two's-complement `i64`.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 7]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @returns The number read, from -2^63 to 2^63 - 1.
 */
export const getI64BE = (b: u8[], off: i32): i64 => {
  bytesWindow("getI64BE", b, off, 8)
  return toI64(getU64BE(b, off))
}

/**
 * The `f64` whose IEEE 754 bits are `getU64LE`'s.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 7]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @returns The double whose bits the eight bytes are.
 */
export const getF64LE = (b: u8[], off: i32): f64 => {
  bytesWindow("getF64LE", b, off, 8)
  return bitsToF64(toI64(getU64LE(b, off)))
}

/**
 * The `f64` whose IEEE 754 bits are `getU64BE`'s.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 7]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @returns The double whose bits the eight bytes are.
 */
export const getF64BE = (b: u8[], off: i32): f64 => {
  bytesWindow("getF64BE", b, off, 8)
  return bitsToF64(toI64(getU64BE(b, off)))
}

/**
 * Writes `v` into `b[off]` and `b[off + 1]`, low byte first.
 *
 * @param b The bytes written into; only the two at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 1]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @param v The number to store.
 */
export const setU16LE = (b: u8[], off: i32, v: u16): void => {
  bytesWindow("setU16LE", b, off, 2)
  b[off] = toU8(v & 255)
  b[off + 1] = toU8((v >> 8) & 255)
}

/**
 * Writes `v` into `b[off]` and `b[off + 1]`, high byte first.
 *
 * @param b The bytes written into; only the two at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 1]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @param v The number to store.
 */
export const setU16BE = (b: u8[], off: i32, v: u16): void => {
  bytesWindow("setU16BE", b, off, 2)
  b[off] = toU8((v >> 8) & 255)
  b[off + 1] = toU8(v & 255)
}

/**
 * Writes `v` into `b[off]` to `b[off + 3]`, least significant byte first.
 *
 * @param b The bytes written into; only the four at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 3]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @param v The number to store.
 */
export const setU32LE = (b: u8[], off: i32, v: u32): void => {
  bytesWindow("setU32LE", b, off, 4)
  b[off] = toU8(v & 255)
  b[off + 1] = toU8((v >> 8) & 255)
  b[off + 2] = toU8((v >> 16) & 255)
  b[off + 3] = toU8((v >> 24) & 255)
}

/**
 * Writes `v` into `b[off]` to `b[off + 3]`, most significant byte first.
 *
 * @param b The bytes written into; only the four at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 3]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @param v The number to store.
 */
export const setU32BE = (b: u8[], off: i32, v: u32): void => {
  bytesWindow("setU32BE", b, off, 4)
  b[off] = toU8((v >> 24) & 255)
  b[off + 1] = toU8((v >> 16) & 255)
  b[off + 2] = toU8((v >> 8) & 255)
  b[off + 3] = toU8(v & 255)
}

/**
 * Writes `v` into `b[off]` to `b[off + 7]`, least significant byte first.
 *
 * @param b The bytes written into; only the eight at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 7]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @param v The number to store.
 */
export const setU64LE = (b: u8[], off: i32, v: u64): void => {
  bytesWindow("setU64LE", b, off, 8)
  b[off] = toU8(v & toU64(255))
  b[off + 1] = toU8((v >> toU64(8)) & toU64(255))
  b[off + 2] = toU8((v >> toU64(16)) & toU64(255))
  b[off + 3] = toU8((v >> toU64(24)) & toU64(255))
  b[off + 4] = toU8((v >> toU64(32)) & toU64(255))
  b[off + 5] = toU8((v >> toU64(40)) & toU64(255))
  b[off + 6] = toU8((v >> toU64(48)) & toU64(255))
  b[off + 7] = toU8((v >> toU64(56)) & toU64(255))
}

/**
 * Writes `v` into `b[off]` to `b[off + 7]`, most significant byte first.
 *
 * @param b The bytes written into; only the eight at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 7]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @param v The number to store.
 */
export const setU64BE = (b: u8[], off: i32, v: u64): void => {
  bytesWindow("setU64BE", b, off, 8)
  b[off] = toU8((v >> toU64(56)) & toU64(255))
  b[off + 1] = toU8((v >> toU64(48)) & toU64(255))
  b[off + 2] = toU8((v >> toU64(40)) & toU64(255))
  b[off + 3] = toU8((v >> toU64(32)) & toU64(255))
  b[off + 4] = toU8((v >> toU64(24)) & toU64(255))
  b[off + 5] = toU8((v >> toU64(16)) & toU64(255))
  b[off + 6] = toU8((v >> toU64(8)) & toU64(255))
  b[off + 7] = toU8(v & toU64(255))
}

/**
 * Writes `v`'s two's-complement bits as `setU32LE` does.
 *
 * @param b The bytes written into; only the four at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 3]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @param v The number to store; a negative one is stored as its two's
 *   complement.
 */
export const setI32LE = (b: u8[], off: i32, v: i32): void => {
  bytesWindow("setI32LE", b, off, 4)
  const u: u32 = toU32(v)
  b[off] = toU8(u & 255)
  b[off + 1] = toU8((u >> 8) & 255)
  b[off + 2] = toU8((u >> 16) & 255)
  b[off + 3] = toU8((u >> 24) & 255)
}

/**
 * Writes `v`'s two's-complement bits as `setU32BE` does.
 *
 * @param b The bytes written into; only the four at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 3]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @param v The number to store; a negative one is stored as its two's
 *   complement.
 */
export const setI32BE = (b: u8[], off: i32, v: i32): void => {
  bytesWindow("setI32BE", b, off, 4)
  const u: u32 = toU32(v)
  b[off] = toU8((u >> 24) & 255)
  b[off + 1] = toU8((u >> 16) & 255)
  b[off + 2] = toU8((u >> 8) & 255)
  b[off + 3] = toU8(u & 255)
}

/**
 * Writes `v`'s two's-complement bits as `setU64LE` does.
 *
 * @param b The bytes written into; only the eight at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 7]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @param v The number to store; a negative one is stored as its two's
 *   complement.
 */
export const setI64LE = (b: u8[], off: i32, v: i64): void => {
  bytesWindow("setI64LE", b, off, 8)
  const u: u64 = toU64(v)
  b[off] = toU8(u & toU64(255))
  b[off + 1] = toU8((u >> toU64(8)) & toU64(255))
  b[off + 2] = toU8((u >> toU64(16)) & toU64(255))
  b[off + 3] = toU8((u >> toU64(24)) & toU64(255))
  b[off + 4] = toU8((u >> toU64(32)) & toU64(255))
  b[off + 5] = toU8((u >> toU64(40)) & toU64(255))
  b[off + 6] = toU8((u >> toU64(48)) & toU64(255))
  b[off + 7] = toU8((u >> toU64(56)) & toU64(255))
}

/**
 * Writes `v`'s two's-complement bits as `setU64BE` does.
 *
 * @param b The bytes written into; only the eight at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 7]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @param v The number to store; a negative one is stored as its two's
 *   complement.
 */
export const setI64BE = (b: u8[], off: i32, v: i64): void => {
  bytesWindow("setI64BE", b, off, 8)
  const u: u64 = toU64(v)
  b[off] = toU8((u >> toU64(56)) & toU64(255))
  b[off + 1] = toU8((u >> toU64(48)) & toU64(255))
  b[off + 2] = toU8((u >> toU64(40)) & toU64(255))
  b[off + 3] = toU8((u >> toU64(32)) & toU64(255))
  b[off + 4] = toU8((u >> toU64(24)) & toU64(255))
  b[off + 5] = toU8((u >> toU64(16)) & toU64(255))
  b[off + 6] = toU8((u >> toU64(8)) & toU64(255))
  b[off + 7] = toU8(u & toU64(255))
}

/**
 * Writes `v`'s IEEE 754 bits as `setU64LE` does.
 *
 * @param b The bytes written into; only the eight at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 7]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @param v The double to store, as its IEEE 754 bits.
 */
export const setF64LE = (b: u8[], off: i32, v: f64): void => {
  bytesWindow("setF64LE", b, off, 8)
  const u: u64 = toU64(f64ToBits(v))
  b[off] = toU8(u & toU64(255))
  b[off + 1] = toU8((u >> toU64(8)) & toU64(255))
  b[off + 2] = toU8((u >> toU64(16)) & toU64(255))
  b[off + 3] = toU8((u >> toU64(24)) & toU64(255))
  b[off + 4] = toU8((u >> toU64(32)) & toU64(255))
  b[off + 5] = toU8((u >> toU64(40)) & toU64(255))
  b[off + 6] = toU8((u >> toU64(48)) & toU64(255))
  b[off + 7] = toU8((u >> toU64(56)) & toU64(255))
}

/**
 * Writes `v`'s IEEE 754 bits as `setU64BE` does.
 *
 * @param b The bytes written into; only the eight at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 7]`, and an offset whose
 *   bytes are not all in `b` panics.
 * @param v The double to store, as its IEEE 754 bits.
 */
export const setF64BE = (b: u8[], off: i32, v: f64): void => {
  bytesWindow("setF64BE", b, off, 8)
  const u: u64 = toU64(f64ToBits(v))
  b[off] = toU8((u >> toU64(56)) & toU64(255))
  b[off + 1] = toU8((u >> toU64(48)) & toU64(255))
  b[off + 2] = toU8((u >> toU64(40)) & toU64(255))
  b[off + 3] = toU8((u >> toU64(32)) & toU64(255))
  b[off + 4] = toU8((u >> toU64(24)) & toU64(255))
  b[off + 5] = toU8((u >> toU64(16)) & toU64(255))
  b[off + 6] = toU8((u >> toU64(8)) & toU64(255))
  b[off + 7] = toU8(u & toU64(255))
}

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
 *
 * @param b The bytes scanned; they are not changed.
 * @param from Where the scan starts, clamped into `[0, to]`.
 * @param to Where the scan stops, exclusive, clamped into `[0, b.length]`.
 * @returns The index of the first byte in the clamped range that is not a
 *   blank, or
 *   the clamped `to` when there is none.
 */
export const skipBlank = (b: u8[], from: i32, to: i32): i32 => {
  const end: i32 = bytesRunEnd(b, to)
  return skipBlankWalk(b, bytesRunStart(from, end), end)
}

/**
 * `skipBlank` for the ASCII digits `0` to `9`: the same clamps, the same
 * kernel family, `nish_bytes_skip_digits`.
 *
 * @param b The bytes scanned; they are not changed.
 * @param from Where the scan starts, clamped into `[0, to]`.
 * @param to Where the scan stops, exclusive, clamped into `[0, b.length]`.
 * @returns The index of the first byte in the clamped range that is not a
 *   digit, or
 *   the clamped `to` when there is none.
 */
export const skipDigits = (b: u8[], from: i32, to: i32): i32 => {
  const end: i32 = bytesRunEnd(b, to)
  return skipDigitsWalk(b, bytesRunStart(from, end), end)
}

/**
 * `skipBlank` for the bytes a JSON string holds as themselves: printable ASCII
 * other than `"` and `\`, and every well-formed UTF-8 sequence (RFC 3629 §4)
 * that ends before `to`. The run stops at the first quote, backslash or control
 * byte, and at the lead byte of a sequence that is malformed — an overlong
 * form, a surrogate, a code point past U+10FFFF, a stray continuation byte — or
 * cut short by `to`.
 *
 * So a whole JSON string body with no escape is one call, and where it stops is
 * the byte a decoder has to look at. Natively the scan is
 * `nish_bytes_skip_json_text`: blocks of ASCII 16 or 32 bytes at a time, each
 * multi-byte sequence a byte at a time. Variable-time, as `skipBlank` is.
 *
 * @param b The bytes scanned; they are not changed.
 * @param from Where the scan starts, clamped into `[0, to]`.
 * @param to Where the scan stops, exclusive, clamped into `[0, b.length]`.
 * @returns The index of the first byte in the clamped range that is not in
 *   the run, or
 *   the clamped `to` when there is none.
 */
export const skipJsonText = (b: u8[], from: i32, to: i32): i32 => {
  const end: i32 = bytesRunEnd(b, to)
  return skipJsonTextWalk(b, bytesRunStart(from, end), end)
}

/**
 * The first index in `[from, to)` whose byte a JSON writer cannot copy as
 * itself — a control byte below `0x20`, a quote or a backslash — or `to`, with
 * the range clamped as `skipBlank`'s is. Every byte from `0x20` up is in the
 * run, `0x7f` and the bytes from `0x80` up included, and no UTF-8 is checked:
 * where `skipJsonText` is the reader's run, this is the writer's, which passes
 * the bytes of a string through as they are. Natively the scan is
 * `nish_bytes_skip_json_plain`, 16 bytes at a time. Variable-time, as
 * `skipBlank` is.
 *
 * @param b The bytes scanned; they are not changed.
 * @param from Where the scan starts, clamped into `[0, to]`.
 * @param to Where the scan stops, exclusive, clamped into `[0, b.length]`.
 * @returns The index of the first byte in the clamped range that a JSON
 *   writer must escape, or
 *   the clamped `to` when there is none.
 */
export const skipJsonPlain = (b: u8[], from: i32, to: i32): i32 => {
  const end: i32 = bytesRunEnd(b, to)
  return skipJsonPlainWalk(b, bytesRunStart(from, end), end)
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
 *
 * @param dst The array written into; only `dst[at..at+count)` changes.
 * @param at Where in `dst` the first copied byte goes.
 * @param src The array copied from, which may be `dst` itself.
 * @param from Where in `src` the copied bytes start.
 * @param count How many bytes to copy; zero copies nothing.
 */
export const copyBytes = (dst: u8[], at: i32, src: readonly u8[], from: i32, count: i32): void => {
  if (!tryCopyBytes(dst, at, src, from, count)) {
    panic("copyBytes: the range lies outside an array")
  }
}

/**
 * `copyBytes` that answers `false`, and writes nothing, where `copyBytes`
 * panics: for a negative `count` or a range that does not lie inside its
 * array. A caller a strict module reaches uses this one, so the out-of-range
 * case is a value it handles rather than a panic site.
 *
 * @param dst The array written into; only `dst[at..at+count)` changes.
 * @param at Where in `dst` the first copied byte goes.
 * @param src The array copied from, which may be `dst` itself.
 * @param from Where in `src` the copied bytes start.
 * @param count How many bytes to copy; zero copies nothing.
 * @returns `true` once the bytes are copied, or `false` when either range
 *   lies outside its array and nothing was written.
 */
export const tryCopyBytes = (dst: u8[], at: i32, src: readonly u8[], from: i32, count: i32): boolean => {
  if (count < 0 || at < 0 || from < 0 || at > toI32(dst.length) - count || from > toI32(src.length) - count) {
    return false
  }
  copyBytesWalk(dst, at, src, from, count)
  return true
}

/**
 * `skipBlank`'s walk, once its range is clamped. This loop and the four
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
 * Where the well-formed UTF-8 sequence whose lead byte is `b[i]` ends, when it
 * ends at or before `to`, or `i` when there is none: RFC 3629's table, with the
 * narrowed second byte after `E0`, `ED`, `F0` and `F4`. The end, not the
 * length, so the caller steps to it without a sum.
 */
const bytesUtf8End = (b: u8[], i: i32, to: i32): i32 => {
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
    return i
  }
  // Each continuation byte is read only once it is known to lie before both
  // `to` and the array's end; a sequence cut short by either is not one.
  if (i < 0 || i >= toI32(b.length)) {
    return i
  }
  let j: i32 = i + 1
  let k: i32 = 1
  while (k < n) {
    if (j >= to || j >= toI32(b.length)) {
      return i
    }
    const c: i32 = toI32(b[j])
    const lowest: i32 = k === 1 ? low : BYTES_NON_ASCII
    const highest: i32 = k === 1 ? high : BYTES_CONTINUATION_TOP
    if (c < lowest || c > highest) {
      return i
    }
    j += 1
    k += 1
  }
  return j
}

/** `skipJsonText`'s walk, once its range is clamped. */
const skipJsonTextWalk = (b: u8[], from: i32, to: i32): i32 => {
  let i: i32 = from
  while (i >= 0 && i < to && i < toI32(b.length)) {
    const c: i32 = toI32(b[i])
    if (c >= BYTES_NON_ASCII) {
      const end: i32 = bytesUtf8End(b, i, to)
      if (end === i) {
        return i
      }
      i = end
      continue
    }
    if (c < BYTES_SPACE || c === BYTES_QUOTE || c === BYTES_BACKSLASH) {
      return i
    }
    i += 1
  }
  return i
}

/** `skipJsonPlain`'s walk, once its range is clamped. */
const skipJsonPlainWalk = (b: u8[], from: i32, to: i32): i32 => {
  let i: i32 = from
  while (i >= 0 && i < to && i < toI32(b.length)) {
    const c: i32 = toI32(b[i])
    if (c < BYTES_SPACE || c === BYTES_QUOTE || c === BYTES_BACKSLASH) {
      return i
    }
    i += 1
  }
  return i
}

/**
 * `copyBytes`'s walk, once its ranges are checked: forward, or backward when
 * `dst` is `src` and the bytes move up. Each index is tested against its array
 * as the walk goes, which the checked ranges always pass; natively the walk is
 * one `llvm.memmove` instead.
 */
const copyBytesWalk = (dst: u8[], at: i32, src: readonly u8[], from: i32, count: i32): void => {
  const dstLength: i32 = toI32(dst.length)
  const srcLength: i32 = toI32(src.length)
  if (at <= from) {
    let d: i32 = at
    let s: i32 = from
    let k: i32 = 0
    while (k < count && d >= 0 && d < dstLength && s >= 0 && s < srcLength) {
      dst[d] = src[s]
      d += 1
      s += 1
      k += 1
    }
    return
  }
  // The last byte of each range, in i64 so the sum cannot overflow; the
  // checked ranges make both fit an i32.
  let d: i32 = toI32(toI64(at) + toI64(count) - toI64(1))
  let s: i32 = toI32(toI64(from) + toI64(count) - toI64(1))
  let k: i32 = count
  while (k > 0 && d >= 0 && d < dstLength && s >= 0 && s < srcLength) {
    dst[d] = src[s]
    d -= 1
    s -= 1
    k -= 1
  }
}

/**
 * `getU32LE` that answers an offset whose four bytes do not all lie in `b`
 * as `Err`, where `getU32LE` panics: the form a strict module reads a
 * record it did not size itself with.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 3]`.
 * @returns The number read, or `Err` naming the offset and the array's length
 *   when a byte of the four lies outside `b`.
 */
export const tryGetU32LE = (b: u8[], off: i32): Result<u32, string> => {
  if (off >= 0 && off < 2147483644 && off + 4 <= toI32(b.length)) {
    // The last byte is read first: once it is in range the checker proves
    // the three below it, where a first read of `b[off]` leaves them unproven.
    const b3: u32 = toU32(b[off + 3])
    const b2: u32 = toU32(b[off + 2])
    const b1: u32 = toU32(b[off + 1])
    const b0: u32 = toU32(b[off])
    return Ok((b0 | (b1 << 8) | (b2 << 16)) + b3 * toU32(0x1000000))
  }
  return Err(bytesRangeError(off, 4, b))
}

/**
 * `getU64LE` that answers an offset whose eight bytes do not all lie in `b`
 * as `Err`, where `getU64LE` panics.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 7]`.
 * @returns The number read, or `Err` naming the offset and the array's length
 *   when a byte of the eight lies outside `b`.
 */
export const tryGetU64LE = (b: u8[], off: i32): Result<u64, string> => {
  if (off >= 0 && off < 2147483640 && off + 8 <= toI32(b.length)) {
    // The last byte first, as in `tryGetU32LE`.
    const b7: u64 = toU64(b[off + 7])
    const b6: u64 = toU64(b[off + 6])
    const b5: u64 = toU64(b[off + 5])
    const b4: u64 = toU64(b[off + 4])
    const b3: u64 = toU64(b[off + 3])
    const b2: u64 = toU64(b[off + 2])
    const b1: u64 = toU64(b[off + 1])
    const b0: u64 = toU64(b[off])
    return Ok(
      b0 |
        (b1 << toU64(8)) |
        ((b2 << toU64(16)) | (b3 << toU64(24))) |
        ((b4 << toU64(32)) | (b5 << toU64(40)) | ((b6 << toU64(48)) | (b7 << toU64(56))))
    )
  }
  return Err(bytesRangeError(off, 8, b))
}

/**
 * `getI32LE` that answers an offset whose four bytes do not all lie in `b`
 * as `Err`, where `getI32LE` panics.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 3]`.
 * @returns The number read, from -2^31 to 2^31 - 1, or `Err` naming the
 *   offset and the array's length when a byte of the four lies outside `b`.
 */
export const tryGetI32LE = (b: u8[], off: i32): Result<i32, string> => {
  const v: Result<u32, string> = tryGetU32LE(b, off)
  if (v.isErr()) {
    return Err(v.error)
  }
  return Ok(toI32(v.value))
}

/**
 * `getI64LE` that answers an offset whose eight bytes do not all lie in `b`
 * as `Err`, where `getI64LE` panics.
 *
 * @param b The bytes the number is read from; they are not changed.
 * @param off Where in `b` its first byte is; it covers `b[off]` to
 *   `b[off + 7]`.
 * @returns The number read, from -2^63 to 2^63 - 1, or `Err` naming the
 *   offset and the array's length when a byte of the eight lies outside `b`.
 */
export const tryGetI64LE = (b: u8[], off: i32): Result<i64, string> => {
  const v: Result<u64, string> = tryGetU64LE(b, off)
  if (v.isErr()) {
    return Err(v.error)
  }
  return Ok(toI64(v.value))
}

/**
 * `setU32LE` that answers `false`, and writes nothing, where `setU32LE`
 * panics: for an offset whose four bytes do not all lie in `b`.
 *
 * @param b The bytes written into; only the four at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 3]`.
 * @param v The number to store.
 * @returns `true` once the bytes are written, or `false` when a byte of the
 *   four lies outside `b` and nothing was written.
 */
export const trySetU32LE = (b: u8[], off: i32, v: u32): boolean => {
  if (off >= 0 && off < 2147483644 && off + 4 <= toI32(b.length)) {
    b[off] = toU8(v & 255)
    b[off + 1] = toU8((v >> 8) & 255)
    b[off + 2] = toU8((v >> 16) & 255)
    b[off + 3] = toU8((v >> 24) & 255)
    return true
  }
  return false
}

/**
 * `setU64LE` that answers `false`, and writes nothing, where `setU64LE`
 * panics: for an offset whose eight bytes do not all lie in `b`.
 *
 * @param b The bytes written into; only the eight at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 7]`.
 * @param v The number to store.
 * @returns `true` once the bytes are written, or `false` when a byte of the
 *   eight lies outside `b` and nothing was written.
 */
export const trySetU64LE = (b: u8[], off: i32, v: u64): boolean => {
  if (off >= 0 && off < 2147483640 && off + 8 <= toI32(b.length)) {
    b[off] = toU8(v & toU64(255))
    b[off + 1] = toU8((v >> toU64(8)) & toU64(255))
    b[off + 2] = toU8((v >> toU64(16)) & toU64(255))
    b[off + 3] = toU8((v >> toU64(24)) & toU64(255))
    b[off + 4] = toU8((v >> toU64(32)) & toU64(255))
    b[off + 5] = toU8((v >> toU64(40)) & toU64(255))
    b[off + 6] = toU8((v >> toU64(48)) & toU64(255))
    b[off + 7] = toU8((v >> toU64(56)) & toU64(255))
    return true
  }
  return false
}

/**
 * `setI32LE` that answers `false`, and writes nothing, where `setI32LE`
 * panics.
 *
 * @param b The bytes written into; only the four at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 3]`.
 * @param v The number to store, as its two's-complement bits.
 * @returns `true` once the bytes are written, or `false` when a byte of the
 *   four lies outside `b` and nothing was written.
 */
export const trySetI32LE = (b: u8[], off: i32, v: i32): boolean => trySetU32LE(b, off, toU32(v))

/**
 * `setI64LE` that answers `false`, and writes nothing, where `setI64LE`
 * panics.
 *
 * @param b The bytes written into; only the eight at `off` change.
 * @param off Where in `b` the first byte goes; it covers `b[off]` to
 *   `b[off + 7]`.
 * @param v The number to store, as its two's-complement bits.
 * @returns `true` once the bytes are written, or `false` when a byte of the
 *   eight lies outside `b` and nothing was written.
 */
export const trySetI64LE = (b: u8[], off: i32, v: i64): boolean => trySetU64LE(b, off, toU64(v))

/** The `Err` text of a checked read whose `width` bytes at `off` do not all lie in `b`. */
const bytesRangeError = (off: i32, width: i32, b: u8[]): string =>
  `bytes ${off} to ${toI64(off) + toI64(width) - toI64(1)} lie outside an array of ${b.length}`

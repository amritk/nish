// `nish/base64`: `base64EncodeIfFits` writes what `base64EncodeInto` writes,
// and answers -1 with nothing written for each range `base64EncodeInto` panics
// on: a source range outside the array, and an encoding that does not fit in
// the destination from `at`.
import { base64EncodeIfFits } from "nish/base64"

/** `dst` as ASCII text, unwritten bytes shown as `.`. */
const shown = (dst: u8[]): string => String.fromBytes(dst, 0, toI32(dst.length))

/** What `base64EncodeIfFits` answers for `src[off..off+len)` into eight `.` bytes from `at`. */
const encode = (src: u8[], off: i32, len: i32, at: i32): string => {
  const dst: u8[] = new Array<u8>(8)
  dst.fill(toU8(46))
  const end: i32 = base64EncodeIfFits(src, off, len, dst, at)
  return `${end} ${shown(dst)}`
}

export const main = (): i32 => {
  const src: u8[] = [toU8(72), toU8(105), toU8(33), toU8(1)]
  console.log(encode(src, 0, 3, 0))
  console.log(encode(src, 0, 2, 1))
  console.log(encode(src, 0, 4, 0))
  console.log(encode(src, 1, 0, 8))
  console.log(encode(src, 0, 4, 1))
  console.log(encode(src, 0, 1, 5))
  console.log(encode(src, 0, 1, -1))
  console.log(encode(src, -1, 1, 0))
  console.log(encode(src, 2, 3, 0))
  console.log(encode(src, 0, -1, 0))
  console.log(encode(src, 1, 0, 9))
  return 0
}

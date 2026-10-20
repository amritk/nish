// `nish/bytes` out of range: a little-endian read at the largest `i32`
// offset, where `off + 1` would overflow, panics `index` on its first byte.
import { getU32LE } from "nish/bytes"

export const main = (): i32 => {
  const b: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4)]
  console.log(`${getU32LE(b, 0)}`)
  console.log(`${getU32LE(b, 2147483647)}`)
  return 0
}

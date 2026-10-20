// `nish/bytes` out of range: a write at the largest `i32` offset, where
// `off + 1` would overflow, panics `index` on its first byte.
import { setU16LE } from "nish/bytes"

export const main = (): i32 => {
  const b: u8[] = [toU8(1), toU8(2)]
  setU16LE(b, 0, toU16(513))
  console.log(`${b[0]} ${b[1]}`)
  setU16LE(b, 2147483647, toU16(0))
  console.log(`${b[0]}`)
  return 0
}

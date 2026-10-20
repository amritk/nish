// `nish/bytes` out of range: a read whose bytes run past the end panics
// `index`, naming the first byte that is not in the array, after the read
// that ends on the last byte has answered.
import { getU32LE } from "nish/bytes"

export const main = (): i32 => {
  const b: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4)]
  console.log(`${getU32LE(b, 0)}`)
  console.log(`${getU32LE(b, 1)}`)
  return 0
}

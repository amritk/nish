// `nish/bytes` out of range: a big-endian 64-bit read one byte short of the
// array panics `index`, naming the first byte that is not in the array,
// after the read that ends on the last byte has answered.
import { getI64BE } from "nish/bytes"

export const main = (): i32 => {
  const b: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4), toU8(5), toU8(6), toU8(7), toU8(8), toU8(9)]
  console.log(`${getI64BE(b, 1)}`)
  console.log(`${getI64BE(b, 2)}`)
  return 0
}

// `nish/bytes` big-endian 64-bit reads: a read whose eighth byte is the
// array's last answers, from the array's start and from inside it, the same
// as a read that ends earlier.
import { getI64BE, getU64BE } from "nish/bytes"

export const main = (): i32 => {
  const b: u8[] = [toU8(128), toU8(1), toU8(2), toU8(3), toU8(4), toU8(5), toU8(6), toU8(7), toU8(255)]
  console.log(`${getU64BE(b, 0)}`)
  console.log(`${getU64BE(b, 1)}`)
  console.log(`${getI64BE(b, 0)}`)
  console.log(`${getI64BE(b, 1)}`)
  const ones: u8[] = [toU8(255), toU8(255), toU8(255), toU8(255), toU8(255), toU8(255), toU8(255), toU8(255)]
  console.log(`${getU64BE(ones, 0)}`)
  console.log(`${getI64BE(ones, 0)}`)
  return 0
}

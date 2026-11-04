// `nish/bytes` out of range: a big-endian 64-bit read at a negative offset
// takes the byte loop, not the fast path, and panics `index` on its first
// byte, after a read from the array's start has answered.
import { getU64BE } from "nish/bytes"

export const main = (): i32 => {
  const b: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4), toU8(5), toU8(6), toU8(7), toU8(8), toU8(9)]
  console.log(`${getU64BE(b, 0)}`)
  console.log(`${getU64BE(b, -1)}`)
  return 0
}

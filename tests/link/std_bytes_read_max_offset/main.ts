// `nish/bytes` out of range: at the largest `i32` offset, where `off + 1`
// would overflow, the read panics `index` on its first byte, before any
// later index is computed.
import { getU64BE } from "nish/bytes"

export const main = (): i32 => {
  const b: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4), toU8(5), toU8(6), toU8(7), toU8(8)]
  console.log(`${getU64BE(b, 0)}`)
  console.log(`${getU64BE(b, 2147483647)}`)
  return 0
}

// `nish/bytes` out of range: at the first offset too large for an eight-byte
// read to be checked whole, the read panics `index` on its first byte, as at
// any offset past the end.
import { getU64BE } from "nish/bytes"

export const main = (): i32 => {
  const b: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4), toU8(5), toU8(6), toU8(7), toU8(8)]
  console.log(`${getU64BE(b, 2147483640)}`)
  return 0
}

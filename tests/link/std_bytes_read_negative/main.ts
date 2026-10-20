// `nish/bytes` out of range: a negative offset panics `index` on its first byte.
import { getU16BE } from "nish/bytes"

export const main = (): i32 => {
  const b: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4)]
  console.log(`${getU16BE(b, 2)}`)
  console.log(`${getU16BE(b, -1)}`)
  return 0
}

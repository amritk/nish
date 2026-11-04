// `nish/bytes` out of range: a big-endian 64-bit read of an empty array
// panics `index` on its first byte.
import { getU64BE } from "nish/bytes"

export const main = (): i32 => {
  const b: u8[] = []
  console.log(`${getU64BE(b, 0)}`)
  return 0
}

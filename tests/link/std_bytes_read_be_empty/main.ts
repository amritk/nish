// `nish/bytes` out of range: a big-endian 64-bit read of an empty array
// panics in its window guard.
import { getU64BE } from "nish/bytes"

export const main = (): i32 => {
  const b: u8[] = []
  console.log(`${getU64BE(b, 0)}`)
  return 0
}

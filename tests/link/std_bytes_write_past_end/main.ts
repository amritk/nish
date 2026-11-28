// `nish/bytes` out of range: a write whose bytes run past the end panics in
// its window guard, before any byte is written.
import { setU32BE } from "nish/bytes"

export const main = (): i32 => {
  const b: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4)]
  setU32BE(b, 0, toU32(0x01020304))
  console.log(`${b[0]} ${b[3]}`)
  setU32BE(b, 2, toU32(0))
  console.log(`${b[2]}`)
  return 0
}

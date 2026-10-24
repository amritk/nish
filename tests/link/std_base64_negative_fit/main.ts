// `nish/base64`: an encoding that would not fit in the destination from `at`
// panics before anything is written.
import { base64EncodeInto } from "nish/base64"

export const main = (): i32 => {
  const src: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4)]
  const dst: u8[] = new Array<u8>(8)
  dst.fill(toU8(46))
  console.log(`${base64EncodeInto(src, 0, 4, dst, 0)}`)
  console.log(`${base64EncodeInto(src, 0, 4, dst, 1)}`)
  return 0
}

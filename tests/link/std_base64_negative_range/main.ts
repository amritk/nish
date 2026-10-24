// `nish/base64`: a source range that runs past the end of the array panics
// before anything is written.
import { base64EncodeInto } from "nish/base64"

export const main = (): i32 => {
  const src: u8[] = [toU8(1), toU8(2), toU8(3)]
  const dst: u8[] = new Array<u8>(8)
  dst.fill(toU8(46))
  console.log(`${base64EncodeInto(src, 1, 2, dst, 0)}`)
  console.log(`${base64EncodeInto(src, 2, 2, dst, 0)}`)
  return 0
}

// `nish/bytes`'s `copyBytes` out of range: a window that runs one byte past the
// end of its source panics before any byte of the destination is written.
import { copyBytes } from "nish/bytes"

/** The bytes of `b` in decimal, a space between each. */
const spaced = (b: u8[]): string => {
  let out: string = ""
  for (let i: i32 = 0; i < toI32(b.length); i += 1) {
    out = i === 0 ? `${b[i]}` : `${out} ${b[i]}`
  }
  return out
}

export const main = (): i32 => {
  const src: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4)]
  const dst: u8[] = [toU8(0), toU8(0), toU8(0), toU8(0)]
  copyBytes(dst, 0, src, 1, 3)
  console.log(`${spaced(dst)}`)
  copyBytes(dst, 0, src, 2, 3)
  console.log(`${spaced(dst)}`)
  return 0
}

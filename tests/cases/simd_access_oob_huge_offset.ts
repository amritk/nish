// `i + 2147483640`, whose last lane is past `INT_MAX`: no length reaches it,
// so the compiler proves nothing and leaves the check, which panics.
import { loadU8x16, extract } from "nish:simd"

const at = (xs: u8[], i: i32): i32 => toI32(extract(loadU8x16(xs, i + 2147483640), 0))

export const main = (): i32 => {
  const xs: u8[] = [1, 2, 3]
  console.log(toI32(xs[0]))
  console.log(at(xs, 0))
  return 0
}

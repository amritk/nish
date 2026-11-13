// `i <= n - 16` bounds a load's last lane but not its first: nothing says `i`
// is not negative, so the load keeps its check and panics at `-1`, named as
// the unsigned value `xs[i]` names it.
import { loadU8x16, extract } from "nish:simd"

const lane = (xs: u8[], i: i32): i32 => {
  const n = toI32(xs.length)
  if (i <= n - 16) {
    return toI32(extract(loadU8x16(xs, i), 0))
  }
  return -1
}

export const main = (): i32 => {
  const xs: u8[] = []
  for (let k = 0; k < 20; k++) {
    xs.push(toU8(k + 1))
  }
  console.log(lane(xs, 2))
  console.log(lane(xs, 0 - 1))
  return 0
}

// Two guards that prove a four-lane load exactly, with no lane to spare:
// `i < xs.length - 3` says `i + 3 < xs.length`, and `i <= n - 3` with
// `n < xs.length` says `i + 3 <= n`, one below the length. Both loops read
// the last lane of every load up to the end of the array.
import { loadI32x4, extract } from "nish:simd"

const strictSum = (xs: i32[]): i32 => {
  let total = 0
  let i = 0
  while (i < toI32(xs.length) - 3) {
    total = total + extract(loadI32x4(xs, i), 3)
    i = i + 1
  }
  return total
}

const belowSum = (xs: i32[], n: i32): i32 => {
  if (n < 0 || n >= toI32(xs.length)) {
    return -1
  }
  let total = 0
  let i = 0
  while (i <= n - 3) {
    total = total + extract(loadI32x4(xs, i), 3)
    i = i + 1
  }
  return total
}

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4, 5, 6]
  console.log(strictSum(xs))
  console.log(belowSum(xs, 5))
  console.log(belowSum(xs, 4))
  return 0
}

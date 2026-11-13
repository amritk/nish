// A vector access whose every lane a fact already places in range has no
// check of its own. In `sum4` the guard `i <= n - 4`, with `n` the hoisted
// length, gives `i + 3 < xs.length`, and `i` counts up from 0. In `twice` the
// first load is checked, and its check passing leaves the same fact behind
// for the second load and for `xs[i + 3]`.
import { loadI32x4, extract } from "nish:simd"

const sum4 = (xs: i32[]): i32 => {
  const n: i32 = toI32(xs.length)
  let total: i32 = 0
  let i: i32 = 0
  while (i <= n - 4) {
    const v = loadI32x4(xs, i)
    total = total + extract(v, 0) + extract(v, 3)
    i += 4
  }
  return total
}

const twice = (xs: i32[], i: i32): i32 => {
  const a = loadI32x4(xs, i)
  const b = loadI32x4(xs, i)
  return extract(a, 1) + extract(b, 2) + xs[i + 3]
}

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  console.log(sum4(xs))
  console.log(twice(xs, 2))
  return 0
}

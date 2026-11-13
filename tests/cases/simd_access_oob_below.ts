// `i <= n - 2` with `n < xs.length` is one lane short of a four-lane load: it
// says `i + 3 <= xs.length`, so the load keeps its check and panics at the
// pass whose last lane is the length.
import { loadI32x4, extract } from "nish:simd"

const firstLanes = (xs: i32[], n: i32): i32 => {
  if (n < 0 || n >= toI32(xs.length)) {
    return -1
  }
  let i = 0
  while (i <= n - 2) {
    console.log(extract(loadI32x4(xs, i), 0))
    i = i + 1
  }
  return 0
}

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4, 5, 6]
  console.log(firstLanes(xs, 5))
  return 0
}

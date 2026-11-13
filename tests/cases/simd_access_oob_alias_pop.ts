// Two handles on one array: the guard proves `xs`, the pops go through `ys`,
// and the caller passes the same array as both. The load keeps its check and
// panics at its last lane, past the two elements left.
import { loadI32x4, extract } from "nish:simd"

const firstLane = (xs: i32[], ys: i32[], off: i32): i32 => {
  if (off < 0 || off > toI32(xs.length) - 4) {
    panic("four lanes do not fit at off")
  }
  console.log(xs[off + 3])
  while (ys.length > 2) {
    ys.pop()
  }
  return extract(loadI32x4(xs, off), 0)
}

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4, 5, 6]
  console.log(firstLane(xs, xs, 0))
  return 0
}

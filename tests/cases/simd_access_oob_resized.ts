// A guard proves a load only until the array can change length: `shrink`
// pops between the guard and the load, so the load keeps its check and
// panics at its last lane, past the two elements left. The same holds for a
// scalar `xs[off + 3]` after the guard.
import { loadI32x4, extract } from "nish:simd"

const shrink = (xs: i32[]): i32 => {
  while (xs.length > 2) {
    xs.pop()
  }
  return 0
}

const firstLane = (xs: i32[], off: i32): i32 => {
  if (off < 0 || off > toI32(xs.length) - 4) {
    panic("four lanes do not fit at off")
  }
  console.log(xs[off + 3])
  shrink(xs)
  return extract(loadI32x4(xs, off), 0)
}

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4, 5, 6]
  console.log(firstLane(xs, 0))
  return 0
}

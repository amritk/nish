// A `pop` in the loop body, with no call between: the guard read a length
// hoisted before the loop, the array shrinks under it, and the load keeps its
// check. The second pass loads lanes 1 to 4 of four elements and panics.
import { loadI32x4, extract } from "nish:simd"

const firstLanes = (xs: i32[]): i32 => {
  const n = toI32(xs.length)
  let total = 0
  let i = 0
  while (i <= n - 4) {
    xs.pop()
    total = total + extract(loadI32x4(xs, i), 0)
    console.log(total)
    i = i + 1
  }
  return total
}

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4, 5, 6]
  console.log(firstLanes(xs))
  return 0
}

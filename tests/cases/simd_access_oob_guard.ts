// A guard one lane short proves nothing: `i <= n - 3` leaves the last lane of
// a four-lane load at `n` itself, so the load keeps its check and panics
// there, naming that lane and the length.
import { loadI32x4, extract } from "nish:simd"

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4, 5, 6]
  const n: i32 = toI32(xs.length)
  let i: i32 = 0
  while (i <= n - 3) {
    console.log(extract(loadI32x4(xs, i), 0))
    i += 1
  }
  return 0
}

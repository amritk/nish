// `i < xs.length - 2` is one lane short of a four-lane load: it says
// `i + 2 < xs.length`, so the load keeps its check and panics at the pass
// whose last lane is the length.
import { loadI32x4, extract } from "nish:simd"

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4, 5, 6]
  let i = 0
  while (i < toI32(xs.length) - 2) {
    console.log(extract(loadI32x4(xs, i), 0))
    i = i + 1
  }
  return 0
}

// WP50 stage 3: a parallel body may read module storage. It is a global, so
// the region reads `@WEIGHTS` where it lives and never captures it.
import { parallelMap } from "nish/threads"

const WEIGHTS = new Int32Array(4)

export const main = (): i32 => {
  for (let i = 0; i < WEIGHTS.length; i++) {
    WEIGHTS[i] = i * 10
  }
  const ys = parallelMap([0, 1, 2, 3], (x: i32): i32 => WEIGHTS[x] + x)
  console.log(`${ys[0]} ${ys[1]} ${ys[2]} ${ys[3]}`)
  return 0
}

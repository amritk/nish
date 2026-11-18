// The host module of the NL2682 case: a buffer with no `at: u32, n: u32` after it.
import type { i32 } from "nish"
export function fill(xs: Float64Array): i32 {
  return xs.length
}

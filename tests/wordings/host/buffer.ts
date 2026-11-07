// The host module of the NL2664 case: a typed-array parameter is stage 3.
import type { i32 } from "nish"
export function fill(xs: Float64Array): i32 {
  return xs.length
}

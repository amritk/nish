// The host module of the NL2665 case: a string parameter is stage 4.
import type { i32 } from "nish"
export function log(s: string): i32 {
  return s.length
}

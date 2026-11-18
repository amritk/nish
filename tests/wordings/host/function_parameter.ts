// The host module of an NL2661 case: a function does not cross.
import type { i32 } from "nish"
export function each(f: (x: i32) => i32): i32 {
  return f(1)
}

// The host module of an NL2661 case: `unknown` does not cross.
import type { i32 } from "nish"
export function size(v: unknown): i32 {
  return v === null ? 0 : 1
}

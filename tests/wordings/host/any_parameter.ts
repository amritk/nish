// The host module of an NL2661 case: `any` does not cross.
import type { i32 } from "nish"
export function size(v: any): i32 {
  return v === null ? 0 : 1
}

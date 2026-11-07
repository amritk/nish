// The host module of the NL2661 case: an object parameter does not cross.
import type { i32 } from "nish"
export function area(box: { w: i32; h: i32 }): i32 {
  return box.w * box.h
}

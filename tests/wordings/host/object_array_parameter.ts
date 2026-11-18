// The host module of an NL2661 case: an array of objects does not cross.
import type { i32 } from "nish"
export function count(boxes: { w: i32 }[]): i32 {
  return boxes.length
}

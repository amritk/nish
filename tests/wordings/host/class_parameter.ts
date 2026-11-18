// The host module of an NL2661 case: a class instance does not cross.
import type { i32 } from "nish"
export class Point {
  x: i32 = 0
}
export function norm(p: Point): i32 {
  return p.x
}

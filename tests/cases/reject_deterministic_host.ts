// --deterministic refuses a host import (NL3054): a host function is `ffi`
// (WP50 §13 Q2), so what the page computes is outside the guarantee.
import { Canvas, width } from "../host-import/golden"

export function wider(c: Canvas): i32 {
  return width(c) + 1
}

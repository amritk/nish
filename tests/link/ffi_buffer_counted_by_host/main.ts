// WP66 S5: `CountedBy` on a host function's parameter is refused before the
// checker reads it, as every other non-scalar a page cannot pass is (NL2661):
// a host module is not C, and its buffers are windows (`at: u32, n: u32`).
import { fill } from "./host"

export const main = (): i32 => {
  return 0
}

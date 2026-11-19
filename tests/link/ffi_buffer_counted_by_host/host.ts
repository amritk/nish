// The host module of ffi_buffer_counted_by_host: `CountedBy` names the count
// of a buffer lent to C, and a host function is the page's, not C's, so it
// does not cross.
import type { i32, u8, u32 } from "nish"
export function fill(dst: CountedBy<u8[], "n">, n: u32): i32 {
  return 0
}

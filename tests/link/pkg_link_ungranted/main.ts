// WP66 S7: the root grants `pkg_mul` `ffi` but not its source, so the link is refused (NL3061).
import { mul } from "pkg_mul"

export const main = (): i32 => {
  console.log(mul(6, 7))
  return 0
}

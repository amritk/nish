// WP66 S7: the root grants `pkg_mul` its source under `nish.link.dependencies`.
import { mul } from "pkg_mul"

export const main = (): i32 => {
  console.log(mul(6, 7))
  return 0
}

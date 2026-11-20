// WP66 S7: the root grants `pkg_mul` its source but not the library it also asks
// for, so the link is refused (NL3061): a grant names each library, not a package.
import { mul } from "pkg_mul"

export const main = (): i32 => {
  console.log(mul(6, 7))
  return 0
}

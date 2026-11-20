// WP66: the root calls a dependency's exported `declare function`, so `ffi`
// is the root's (expected.caps.json), and links the dependency's source under
// `nish.link.dependencies`.
import { pkg_link_mul } from "pkg_mul"

export const main = (): i32 => {
  console.log(pkg_link_mul(6, 7))
  return 0
}

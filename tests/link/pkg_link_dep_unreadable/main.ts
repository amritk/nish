// WP66 S7: a dependency's `nish` field this reader cannot read, in a manifest that
// mentions `link`, is refused (NL3059), not skipped: an unread field may be a link.
import { mul } from "pkg_mul"

export const main = (): i32 => {
  console.log(mul(6, 7))
  return 0
}

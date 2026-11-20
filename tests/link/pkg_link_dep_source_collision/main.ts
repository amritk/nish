// WP66 S7: the root grants `pkg_mul` the source `"c/\u00e9.c"` and the
// dependency asks for `"c/\u00ea.c"`. The manifest decoder turns both escapes
// into DEL, so before PL-F1 the two read as one path and the ask matched the
// grant; now the grant and the ask are each refused (NL3060) as a path that is
// not printable ASCII, and nothing links (docs/security/package-link.md, PL-F1,
// PL-4).
import { mul } from "pkg_mul"

export const main = (): i32 => {
  console.log(mul(6, 7))
  return 0
}

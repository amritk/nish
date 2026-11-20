// WP66 S7: a dependency's `nish.link` list missing its comma. The list reader
// alone would step over the gap and read two entries; the manifest is checked
// as JSON first, so it is refused where it breaks and nothing links
// (docs/security/package-link.md, PL-4).
import { mul } from "pkg_mul"

export const main = (): i32 => {
  console.log(mul(6, 7))
  return 0
}

// An unguarded `nish:simd` load stays an unproven panic site. `simd_mask` is
// `simd_deny_panics_guarded`'s `newlineMask` with the length guard
// `i <= xs.length - 16` dropped: `i < xs.length` places the first lane in
// range but not the sixteenth, so the load keeps its check and the panic table
// records the index site as unproven. `simd_mask` is a dependency, outside the
// no-panic scope `--deny-panics` (`args`) puts this package in, so the build
// refuses the call into it that reaches the site.
import { newlineMask } from "simd_mask"

export const main = (): i32 => {
  const xs: u8[] = new Array<u8>(32)
  xs[0] = 10
  xs[5] = 10
  xs[17] = 10
  xs[31] = 10
  console.log(newlineMask(xs))
  return 0
}

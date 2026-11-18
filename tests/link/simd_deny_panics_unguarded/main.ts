// An unguarded `nish:simd` load stays an unproven panic site. `mask.ts` is
// `simd_deny_panics_guarded`'s `newlineMask` with the length guard
// `i <= xs.length - 16` dropped: `i < xs.length` places the first lane in
// range but not the sixteenth, so the load keeps its check, the panic table
// records the index site as unproven, and the `--deny-panics` build (`args`)
// refuses it, with advice that names the guard proving both ends.
import { newlineMask } from "./mask"

export const main = (): i32 => {
  const xs: u8[] = new Array<u8>(32)
  xs[0] = 10
  xs[5] = 10
  xs[17] = 10
  xs[31] = 10
  console.log(newlineMask(xs))
  return 0
}

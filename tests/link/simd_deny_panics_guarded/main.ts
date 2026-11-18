// A guarded `nish:simd` access is a proven panic site. `simd_mask` is a
// dependency, outside the no-panic scope `--deny-panics` (`args`) puts this
// package in, so each call below is accepted only if the callee cannot panic.
// In `newlineMask` and `fillNewlines` the loop test
// `i >= 0 && i <= xs.length - 16` places every lane of `loadU8x16(xs, i)` and
// of `store(newline, xs, i)` in range: `bounds.ts` drops both checks, and the
// panic table records both sites as proven from that same fact.
// `simd_deny_panics_unguarded` is the load without the guard.
import { fillNewlines, newlineMask } from "simd_mask"

export const main = (): i32 => {
  const xs: u8[] = new Array<u8>(32)
  xs[0] = 10
  xs[5] = 10
  xs[17] = 10
  xs[31] = 10
  console.log(newlineMask(xs))
  const ys: u8[] = new Array<u8>(16)
  fillNewlines(ys)
  console.log(newlineMask(ys))
  return 0
}

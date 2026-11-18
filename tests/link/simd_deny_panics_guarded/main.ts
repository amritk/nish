// A guarded `nish:simd` load is a proven panic site. In `mask.ts`'s
// `newlineMask` the loop test `i >= 0 && i <= xs.length - 16` places every
// lane of `loadU8x16(xs, i)` in range: `bounds.ts` drops the load's check, and
// the panic table records the site as proven from that same fact, so the
// `--deny-panics` build (`args`) accepts `main`'s call into it.
// `simd_deny_panics_unguarded` is the same function without the guard.
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

// An unguarded `nish:simd` access in the program's own package is refused
// where it is written. `--deny-panics` (`args`) puts both of these modules in
// the no-panic scope, so each unproven load in `lanes.ts` is NL2457 at the
// load, with advice that names the guard proving its first and last lanes:
// `- 16` for the `u8x16` load, `- 4` for the `i32x4` one. The third load's
// array comes from a call, so its advice states the rule in words rather than
// a guard over a variable the caller does not have.
// `simd_deny_panics_unguarded` is the same load reached across the scope.
import { firstBytes, firstWords, fromCall } from "./lanes"

export const main = (): i32 => {
  const xs: u8[] = new Array<u8>(32)
  const ws: i32[] = new Array<i32>(8)
  console.log(firstBytes(xs, 3))
  console.log(firstWords(ws, 3))
  console.log(fromCall(3))
  return 0
}

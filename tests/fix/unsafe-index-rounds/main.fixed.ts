// Several sites in one module. Every fix carries the same import edit, so the
// first round applies one of them and drops the rest as overlapping; the
// second, with the import written, applies all the others. The `rewrites`
// file counts those two rounds and the one that fixes `seed.ts`.
import { uncheckedGet, uncheckedSet } from "nish:unsafe"

export const step = (xs: i32[], bytes: u8[], k: i32, v: i32): i32 => {
  uncheckedSet(xs, k, v)
  uncheckedSet(bytes, k, uncheckedGet(bytes, k) + 1)
  const a = uncheckedGet(xs, k + 1)
  return a + uncheckedGet(xs, k - 1)
}

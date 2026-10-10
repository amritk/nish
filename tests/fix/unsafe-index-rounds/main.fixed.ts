// Several sites in one module. Every fix carries the same import edit, and
// `--fix` makes an edit it has already accepted once rather than dropping the
// fix that repeats it, so one round applies every site with the import. The
// `rewrites` file counts that round and the one that fixes `seed.ts`.
import { uncheckedGet, uncheckedSet } from "nish:unsafe"

export const step = (xs: i32[], bytes: u8[], k: i32, v: i32): i32 => {
  uncheckedSet(xs, k, v)
  uncheckedSet(bytes, k, uncheckedGet(bytes, k) + 1)
  const a = uncheckedGet(xs, k + 1)
  return a + uncheckedGet(xs, k - 1)
}

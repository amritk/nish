// The module already imports `uncheckedGet`, so the fix extends that import
// with `uncheckedSet` rather than writing a second one.
import { uncheckedGet, uncheckedSet } from "nish:unsafe"

export const copy = (dst: i32[], src: i32[], k: i32): void => {
  uncheckedSet(dst, k, uncheckedGet(src, k))
}

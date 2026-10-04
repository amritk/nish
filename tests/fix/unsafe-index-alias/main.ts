// Both names are already imported under aliases, so the rewrite calls them by
// those and adds no import: one round.
import { uncheckedGet as get, uncheckedSet as put } from "nish:unsafe"

export const bump = (xs: i32[], k: i32): i32 => {
  xs[k] += 1
  return get(xs, k)
}

export const store = (xs: i32[], k: i32): void => {
  put(xs, k, 0)
}

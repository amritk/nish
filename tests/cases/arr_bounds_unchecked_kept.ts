// #461: `uncheckedGet` and `uncheckedSet` move no length to the bounds proof,
// but neither has a check to have passed, so neither proves anything: each
// checked access below keeps its `nish_panic_index`.
import { uncheckedGet, uncheckedSet } from "nish:unsafe"

// `uncheckedGet(xs, i)` is no check of `i`, so `xs[i]` after it is still one.
export const readTwice = (xs: i32[], i: i32): i32 => uncheckedGet(xs, i) + xs[i]

// The same after `uncheckedSet`.
export const writeThenRead = (xs: i32[], i: i32): i32 => {
  uncheckedSet(xs, i, 7)
  return xs[i]
}

const shrink = (xs: i32[]): i32 => {
  xs.pop()
  return 0
}

// `i < xs.length` held, but the value `uncheckedSet` stores calls `shrink`,
// which pops: the call still takes the length fact away, so `xs[i]` keeps its
// check.
export const shrinkAcross = (xs: i32[], i: i32): i32 => {
  if (i >= 0 && i < xs.length) {
    uncheckedSet(xs, 0, shrink(xs))
    return xs[i]
  }
  return -1
}

// And a resize after the call: `uncheckedSet` keeps the fact, the `pop`
// after it does not.
export const popAfter = (xs: i32[], i: i32): i32 => {
  if (i >= 0 && i < xs.length) {
    uncheckedSet(xs, 0, 1)
    xs.pop()
    return xs[i]
  }
  return -1
}

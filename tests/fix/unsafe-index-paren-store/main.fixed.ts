// A store written in parentheses is still a statement, so it is still fixed;
// the rewrite replaces the parentheses too, because `uncheckedSet` has to be
// the statement's expression itself.
import { uncheckedGet, uncheckedSet } from "nish:unsafe"

export const bump = (xs: i32[], k: i32, v: i32): void => {
  uncheckedSet(xs, k, v)
  ;uncheckedSet(xs, k, uncheckedGet(xs, k) + 1)
}

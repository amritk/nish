// A store written in parentheses is still a statement, so it is still fixed;
// the rewrite replaces the parentheses too, because `uncheckedSet` has to be
// the statement's expression itself.
export const bump = (xs: i32[], k: i32, v: i32): void => {
  (xs[k] = v)
  ;((xs[k] += 1))
}

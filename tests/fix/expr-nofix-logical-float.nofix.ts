// NL2099: a condition with a float operand of `&&` has no fix, not even for
// its integer operand: a fix is applied whole or not at all, and a float has
// no comparison that is its truthiness (`NaN` is falsy).
export const test = (x: f64, n: i32): number => {
  if (n && x) {
    return 1
  }
  return 0
}

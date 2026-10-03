// NL2188: a float condition has no fix. `NaN` is falsy, and `NaN !== 0` is
// true, so `!== 0` would not be the test `tsc` reads.
export const test = (x: f64): number => {
  if (x) {
    return 1
  }
  return 0
}

// NL2263: `!x` on a float has no fix. `NaN` is falsy, and `NaN === 0` is
// false, so `=== 0` would not be the test `tsc` reads.
export const test = (x: f64): number => (!x ? 1 : 0)

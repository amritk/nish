// --deny-panics under `--number-mode f64`: a length is an `f64`, so the guard
// for an `i32` index spells the bound `toI32(xs.length)`, which compiles and
// is credited in both modes.
export const at = (xs: number[], i: i32): number => xs[i];

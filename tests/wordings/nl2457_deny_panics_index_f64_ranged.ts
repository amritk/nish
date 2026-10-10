// --deny-panics under `--number-mode f64`: a ranged index is an `i32`, so its
// guard spells the bound `toI32(xs.length)` as an `i32` index's does.
export const at = (xs: i32[], k: i32): i32 => {
  if (k >= 0 && k <= 9) {
    const i: integer<0, 9> = k
    return xs[i]
  }
  return 0
}

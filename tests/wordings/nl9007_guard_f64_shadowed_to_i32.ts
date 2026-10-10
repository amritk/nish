// Under `--number-mode f64` the credited guard for an `i32` index calls the
// builtin `toI32`, which this module's own `toI32` hides: NL9007 offers no
// guard spelling.
const toI32 = (x: number): number => x

export const sumAt = (xs: number[], idx: i32[]): number => {
  let total = toI32(0)
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}

// Under `--number-mode f64` a length is an `f64`, so `i < xs.length` does not
// type-check against an `i32` index: NL9007 spells the bound
// `toI32(xs.length)`, which compiles in both modes and is credited.
export const sumAt = (xs: number[], idx: i32[]): number => {
  let total = 0
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}

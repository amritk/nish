// Under `--number-mode f64` a length is an `f64`, so the guard NL9007 names
// for an offset index spells the bound `toI32(ys.length)`, which compiles in
// both modes and is credited.
export const pairSums = (xs: number[], ys: number[]): number => {
  let total = 0
  for (let i: i32 = 0; i + 1 < toI32(xs.length); i++) {
    total = total + ys[i + 1]
  }
  return total
}

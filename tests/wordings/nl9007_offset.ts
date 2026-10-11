// An offset index that keeps its check: NL9007 names the sum and a guard on
// it, which the bounds analysis credits.
export const pairSums = (xs: i32[], ys: i32[]): i32 => {
  let total = 0
  for (let i = 0; i + 1 < xs.length; i++) {
    total = total + ys[i + 1]
  }
  return total
}

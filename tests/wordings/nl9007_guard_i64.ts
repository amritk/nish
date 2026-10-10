// An `i64` index has no guard the bounds analysis credits: `i < xs.length`
// does not type-check against it, and a `toI64(xs.length)` bound is not read.
// NL9007 offers no guard spelling.
export const sumAt = (xs: i32[], idx: i64[]): i32 => {
  let total = 0
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}

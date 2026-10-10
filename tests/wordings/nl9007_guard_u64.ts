// A `u64` index has no guard the bounds analysis credits: `i < xs.length`
// does not type-check against it, `toU32` would keep its low 32 bits, and a
// `toU64(xs.length)` bound is not read. NL9007 offers no guard spelling.
export const sumAt = (xs: i32[], idx: u64[]): i32 => {
  let total = 0
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}

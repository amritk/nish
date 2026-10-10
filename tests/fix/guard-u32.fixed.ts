// NL9007 on a u32 index: its type is the lower end, and an `i32` compare does
// not type-check against it, so the fix inserts the upper end alone as a
// `u32` compare, which the bounds analysis credits.
const sumAt = (xs: i32[], idx: u32[]): i32 => {
  let total = 0
  for (const i of idx) {
    if (!(toU32(i) < toU32(xs.length))) { panic("index out of range") }
    total = total + xs[i]
  }
  return total
}

export const main = (): number => {
  const idx: u32[] = [0, 2]
  console.log(`${sumAt([1, 2, 3], idx)}`)
  return 0
}

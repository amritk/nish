// A u64 index: `toU32` would keep its low 32 bits, which may be below the
// length while the index is not, so no guard both compiles and removes the
// check, and NL9007 carries no fix.
const sumAt = (xs: i32[], idx: u64[]): i32 => {
  let total = 0
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}

export const main = (): number => {
  const idx: u64[] = [0, 2]
  console.log(`${sumAt([1, 2, 3], idx)}`)
  return 0
}

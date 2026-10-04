// An i64 index: `toI64` is not credited, so no guard both compiles and
// removes the check, and NL9007 carries no fix.
const sumAt = (xs: i32[], idx: i64[]): i32 => {
  let total = 0
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}

export const main = (): number => {
  const idx: i64[] = [0, 2]
  console.log(`${sumAt([1, 2, 3], idx)}`)
  return 0
}

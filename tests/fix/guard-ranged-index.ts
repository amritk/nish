// NL9007 on a ranged index: its declaration proves `0 <= i` but not that it
// is below the length, and the guard's compare reads it as its base, i32.
const pick = (xs: i32[], idx: integer<0, 1000>[]): i32 => {
  let total = 0
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}

export const main = (): number => {
  const idx: integer<0, 1000>[] = [1, 2]
  console.log(`${pick([5, 6, 7], idx)}`)
  return 0
}

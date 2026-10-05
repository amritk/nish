// A u32 index: the guard's i32 compare does not type-check against it.
const sumAt = (xs: i32[], idx: u32[]): i32 => {
  let total = 0
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}

export const main = (): number => {
  const idx: u32[] = [0, 2]
  console.log(`${sumAt([1, 2, 3], idx)}`)
  return 0
}

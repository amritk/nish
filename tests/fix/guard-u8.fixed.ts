// NL9007 on a u8 index: `toU32` widens it for the guard's `u32` compare.
const sumAt = (xs: i32[], idx: u8[]): i32 => {
  let total = 0
  for (const i of idx) {
    if (!(toU32(i) < toU32(xs.length))) { panic("index out of range") }
    total = total + xs[i]
  }
  return total
}

export const main = (): number => {
  const idx: u8[] = [3, 1]
  console.log(`${sumAt([10, 20, 30, 40], idx)}`)
  return 0
}

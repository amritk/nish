// NL9007 on a u16 index, out of range: `toU32` widens it for the guard's
// `u32` compare. The input stops at the runtime's index error and the fixed
// program at the guard's panic, after the same line, and both exit 1.
const sumAt = (xs: i32[], idx: u16[]): i32 => {
  let total = 0
  for (const i of idx) {
    console.log(`at ${i}`)
    total = total + xs[i]
  }
  return total
}

export const main = (): number => {
  const idx: u16[] = [1, 65535, 0]
  console.log(`${sumAt([10, 20, 30], idx)}`)
  return 0
}

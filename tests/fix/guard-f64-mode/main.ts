// Under `--number-mode f64` a length is an f64, so `i < xs.length` does not
// compile with an i32 index and the guard spells the bound `toI32(xs.length)`.
const sumAt = (xs: number[], idx: i32[]): number => {
  let total = 0
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}

export const main = (): i32 => {
  console.log(`${sumAt([1.5, 2.5, 3.5], [0, 2])}`)
  return 0
}

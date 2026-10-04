// Under `--deny-panics` the unproven index is refused as a panic site
// (NL2457), which withdraws its NL9007, and a guard ending in `panic` would be
// refused in its turn: --fix applies nothing.
const sumAt = (xs: i32[], idx: i32[]): i32 => {
  let total = 0
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}

export const main = (): number => {
  console.log(`${sumAt([1, 2, 3], [0, 2])}`)
  return 0
}

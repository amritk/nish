// The round trip out of range: the input stops at the runtime's index error,
// the fixed program at the guard's panic, and both print the same line first
// and exit 1.
const sumAt = (xs: i32[], idx: i32[]): i32 => {
  let total = 0
  for (const i of idx) {
    console.log(`at ${i}`)
    total = total + xs[i]
  }
  return total
}

export const main = (): number => {
  console.log(`${sumAt([10, 20, 30], [1, 7, 0])}`)
  return 0
}

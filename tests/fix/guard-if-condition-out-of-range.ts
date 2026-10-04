// The `if`-test shape run out of range: the input stops at the runtime's
// index error, the fixed program at the guard's panic, and both print the
// same lines first and exit 1.
const countPositive = (xs: i32[], idx: i32[]): i32 => {
  let count = 0
  for (const i of idx) {
    console.log(`at ${i}`)
    if (xs[i] > 0) {
      count = count + 1
    }
  }
  return count
}

export const main = (): number => {
  console.log(`${countPositive([3, -1, 4], [0, 5, 2])}`)
  return 0
}

// The access is in an `if`'s test, which runs before either branch, so the
// assignment in the branch does not keep the guard out.
const countPositive = (xs: i32[], idx: i32[]): i32 => {
  let count = 0
  for (const i of idx) {
    if (xs[i] > 0) {
      count = count + 1
    }
  }
  return count
}

export const main = (): number => {
  console.log(`${countPositive([3, -1, 4], [0, 1, 2])}`)
  return 0
}

// The access is the right operand of `&&`, read only when the first test
// holds, so a guard before the statement would panic where the program does not.
const countBig = (xs: i32[], idx: i32[], limit: i32): i32 => {
  let count = 0
  for (const i of idx) {
    if (i < limit && xs[i] > 1) {
      count = count + 1
    }
  }
  return count
}

export const main = (): number => {
  console.log(`${countBig([1, 2, 3], [0, 2, 9], 3)}`)
  return 0
}

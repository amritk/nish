// The access is the second operand of `? :`, which reads it only when the
// test holds, so a guard before the statement would panic where the program
// does not.
const sumAt = (xs: i32[], idx: i32[], limit: i32): i32 => {
  let total = 0
  for (const i of idx) {
    total = total + (i < limit ? xs[i] : 0)
  }
  return total
}

export const main = (): number => {
  console.log(`${sumAt([1, 2, 3], [0, 9], 3)}`)
  return 0
}

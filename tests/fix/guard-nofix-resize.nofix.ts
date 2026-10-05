// A call before the access may resize the array, so a guard placed before
// the statement would test a length the access no longer sees.
const grow = (xs: i32[]): i32 => {
  xs.push(0)
  return 1
}

const sumAt = (xs: i32[], idx: i32[]): i32 => {
  let total = 0
  for (const i of idx) {
    total = total + grow(xs) + xs[i]
  }
  return total
}

export const main = (): number => {
  console.log(`${sumAt([1, 2, 3], [0, 3])}`)
  return 0
}

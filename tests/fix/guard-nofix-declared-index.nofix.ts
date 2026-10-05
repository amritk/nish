// The statement declares the index it reads, so a guard before it would read
// `j` before its declaration.
const sumAt = (xs: i32[], idx: i32[]): i32 => {
  let total = 0
  for (const i of idx) {
    const j = i, v = xs[j]
    total = total + v
  }
  return total
}

export const main = (): number => {
  console.log(`${sumAt([1, 2, 3], [0, 2])}`)
  return 0
}

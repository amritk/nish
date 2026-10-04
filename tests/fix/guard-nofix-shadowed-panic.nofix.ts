// A function of the module is called `panic`, so the guard's call would not
// reach the builtin and the analysis would not credit it.
const panic = (message: string): void => {
  console.log(message)
}

const sumAt = (xs: i32[], idx: i32[]): i32 => {
  let total = 0
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}

export const main = (): number => {
  panic("start")
  console.log(`${sumAt([1, 2, 3], [0, 2])}`)
  return 0
}

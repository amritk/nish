// The access is in the loop's own condition, so there is no statement to put
// a guard before that runs on every iteration.
const lengthTo = (xs: i32[], start: i32): i32 => {
  let i = start
  while (xs[i] !== 0) {
    i = i + 1
  }
  return i
}

export const main = (): number => {
  console.log(`${lengthTo([3, 2, 1, 0], 0)}`)
  return 0
}

// WP51 stage 1: an array of references, filled by a literal and by `push`,
// read by index and by `for...of`. A function type outside a parameter is a
// reference type, and an array of one prints in parentheses.
type Step = (x: i32) => i32

const inc = (x: i32): i32 => x + 1
const square = (x: i32): i32 => x * x
const half = (x: i32): i32 => x / 2

// `at` indexes with `i` and `first` adds it: a scalar argument has no place
// to lose, so a set mixing them is no escape join.
type Get = (xs: i32[], i: i32) => i32
const at = (xs: i32[], i: i32): i32 => xs[i]
const first = (xs: i32[], i: i32): i32 => xs[0] + i

export const main = (): void => {
  const steps: Step[] = [inc, square]
  steps.push(half)
  let v = 3
  for (const step of steps) {
    v = step(v)
  }
  const gets: Get[] = [at, first]
  const xs: i32[] = [5, 6, 7]
  let g = 0
  for (let k = 0; k < 2; k++) {
    g = g + gets[k](xs, 1)
  }
  console.log(`${v} ${steps.length} ${steps[1](7)} ${g}`)
}

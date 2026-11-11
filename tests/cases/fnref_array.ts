// WP51 stage 1: an array of references, filled by a literal and by `push`,
// read by index and by `for...of`. A function type outside a parameter is a
// reference type, and an array of one prints in parentheses.
type Step = (x: i32) => i32

const inc = (x: i32): i32 => x + 1
const square = (x: i32): i32 => x * x
const half = (x: i32): i32 => x / 2

export const main = (): void => {
  const steps: Step[] = [inc, square]
  steps.push(half)
  let v = 3
  for (const step of steps) {
    v = step(v)
  }
  console.log(`${v} ${steps.length} ${steps[1](7)}`)
}

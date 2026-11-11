// WP51 stage 1: an array of references read by a callback. `fs.map` and
// `fs.filter` call each element inside an arrow, from a function that takes
// the array as a parameter and is called from two sites.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1
const twice = (x: i32): i32 => x * 2
const neg = (x: i32): i32 => 0 - x

const applyAll = (fs: F[]): i32 => {
  const outs = fs.map((g) => g(10))
  const big = fs.filter((g) => g(1) > 1)
  let sum = 0
  for (const o of outs) {
    sum = sum + o
  }
  return sum * 100 + big.length
}

export const main = (): void => {
  console.log(`${applyAll([inc, twice])}`)
  console.log(`${applyAll([neg, inc, twice])}`)
}

// A parameter is called `toI32`, so the guard's `toI32(xs.length)` would not
// be the builtin conversion.
const sumAt = (xs: i32[], idx: i32[], toI32: i32): i32 => {
  let total = toI32
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}

export const main = (): number => {
  console.log(`${sumAt([1, 2, 3], [0, 2], 0)}`)
  return 0
}

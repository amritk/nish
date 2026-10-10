// A parameter is called `toU32`, so the guard's `toU32(xs.length)` for this
// unsigned index would not be the builtin conversion.
const sumAt = (xs: i32[], idx: u32[], toU32: i32): i32 => {
  let total = toU32
  for (const i of idx) {
    total = total + xs[i]
  }
  return total
}

export const main = (): number => {
  const idx: u32[] = [0, 2]
  console.log(`${sumAt([1, 2, 3], idx, 0)}`)
  return 0
}

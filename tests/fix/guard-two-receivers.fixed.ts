// Two NL9007s in one statement insert at the same offset, so the driver
// applies the first and the second round applies the other.
const dot = (xs: i32[], ys: i32[], idx: i32[]): i32 => {
  let total = 0
  for (const i of idx) {
    if (!(i >= 0 && i < toI32(xs.length))) { panic("index out of range") }
    if (!(i >= 0 && i < toI32(ys.length))) { panic("index out of range") }
    total = total + xs[i] * ys[i]
  }
  return total
}

export const main = (): number => {
  console.log(`${dot([1, 2, 3], [4, 5, 6], [0, 2])}`)
  return 0
}

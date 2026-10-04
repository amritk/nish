// NL9007: `i` comes from another array, so nothing proves it in range for
// `xs`. The fix inserts a guard the bounds analysis credits.
const sumAt = (xs: i32[], idx: i32[]): i32 => {
  let total = 0
  for (const i of idx) {
    if (!(i >= 0 && i < toI32(xs.length))) { panic("index out of range") }
    total = total + xs[i]
  }
  return total
}

export const main = (): number => {
  const xs = [10, 20, 30, 40]
  console.log(`${sumAt(xs, [0, 2, 3])}`)
  return 0
}

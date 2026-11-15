// An array pattern reads each named index as `xs[i]` does, so a pattern longer
// than the array panics where Node would bind `undefined`.
export const main = (): void => {
  const xs = [1, 2, 3]
  console.log(xs.length)
  const [a, , , , , f] = xs
  console.log(a + f)
}

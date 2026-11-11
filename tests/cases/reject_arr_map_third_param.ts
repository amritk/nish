// The callback takes the element, or the element and its index, as in
// TypeScript; JavaScript's third parameter, the array, is refused.
export const main = (): number => {
  const xs: number[] = [3, 1, 2]
  const ys = xs.map((x, i, all) => x + i + all.length)
  return ys[0]
}

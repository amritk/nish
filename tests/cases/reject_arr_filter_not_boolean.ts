// `filter`'s callback answers a `boolean`, not a number JavaScript would read
// as truthy.
export const main = (): number => {
  const xs: number[] = [3, 0, 2]
  const ys = xs.filter((x) => x)
  return ys.length
}

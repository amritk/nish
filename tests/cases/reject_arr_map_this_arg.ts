// `map` takes exactly one argument, its callback; JavaScript's `thisArg` is refused.
export const main = (): number => {
  const xs: number[] = [3, 1, 2]
  const ys = xs.map((x) => x + 1, 0)
  return ys[0]
}

export const main = (): number => {
  const xs: readonly number[] = [3, 1, 2]
  xs.sort((a, b) => a - b)
  return xs[0]
}

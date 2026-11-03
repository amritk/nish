export const main = (): number => {
  const xs = [3, 1, 2]
  xs.sort((a, b) => a - b, 1)
  return xs[0]
}

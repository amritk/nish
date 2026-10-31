export const main = (): number => {
  const xs = [3, 1, 2]
  const k = 2
  xs.sort((a, b) => a * k - b)
  return xs[0]
}

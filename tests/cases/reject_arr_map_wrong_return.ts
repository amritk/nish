// `map`'s callback decides the element type of the answer, so a callback that
// answers a number cannot fill a `string[]`.
export const main = (): number => {
  const xs: number[] = [3, 1, 2]
  const ys: string[] = xs.map((x) => x * 2)
  return ys.length
}

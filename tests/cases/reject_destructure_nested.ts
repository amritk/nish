// NL2776: a pattern inside a pattern.
export const main = (): void => {
  const [[a]] = [[1]]
  console.log(a)
}

// NL2778: a Map has no fields to read.
export const main = (): void => {
  const m = new Map<string, number>()
  const { size } = m
  console.log(size)
}

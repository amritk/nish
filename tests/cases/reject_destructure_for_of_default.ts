// A default pattern in a `for...of` head is refused as in a declaration.
export const main = (): void => {
  const rows: number[][] = [[1, 2], [3, 4]]
  for (const [a, b = 0] of rows) {
    console.log(a)
  }
}

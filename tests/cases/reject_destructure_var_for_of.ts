// `for (var [a] of ...)`: a `var` pattern in a `for...of` head is refused as
// `var`, at the declaration the user wrote.
export const main = (): void => {
  const rows = [[1, 2]]
  for (var [a] of rows) {
    console.log(a)
  }
}

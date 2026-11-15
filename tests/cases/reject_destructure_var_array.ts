// `var` with an array pattern is a `var` declaration, as TypeScript reads it,
// and is refused as `var` is: the error spans the statement the user wrote.
export const main = (): void => {
  const xs = [4, 7]
  var [a] = xs
  console.log(a)
}

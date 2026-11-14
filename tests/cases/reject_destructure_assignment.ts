// NL2771: a pattern on the left of `=` is not a declaration.
export const main = (): void => {
  let a = 1
  let b = 2
  ;[a, b] = [b, a]
  console.log(a + b)
}

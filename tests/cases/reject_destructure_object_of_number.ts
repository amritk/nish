// NL2780: an object pattern reads a class or interface value.
export const main = (): void => {
  const n = 3
  const { x } = n
  console.log(x)
}

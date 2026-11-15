// A default in an array pattern is refused as in an object pattern.
export const main = (): void => {
  const xs = [1, 2]
  const [a = 0] = xs
  console.log(a)
}

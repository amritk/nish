// `const [a, , c] = xs` reads `xs[0]` and `xs[2]`, each with the bounds check
// `xs[i]` has; the hole reads nothing.
export const main = (): void => {
  const xs = [10, 20, 30]
  const [a, , c] = xs
  console.log(a + c)
  let [first, second] = ["one", "two", "three"]
  first = `${first}!`
  console.log(`${first} ${second}`)
}

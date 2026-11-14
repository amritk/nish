// `using [a] = xs` is not a `using` declaration: TypeScript reads `using [`
// as an element of a variable named `using`, so `using` never binds a
// pattern. Here no such variable exists.
export const main = (): void => {
  const xs = [4, 7]
  using [a] = xs
  console.log(xs[0])
}

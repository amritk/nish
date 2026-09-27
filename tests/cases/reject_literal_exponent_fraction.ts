// An exponent that leaves a fraction is not an integer: `1e-1` is 0.1 (#267).
export const main = (): void => {
  const x: i32 = 1e-1
  console.log(x)
}

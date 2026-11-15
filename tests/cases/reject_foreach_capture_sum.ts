// An arrow argument never assigns a name of the function it is written in, a
// `forEach` callback included; the refusal points at the `for...of` loop.
export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3]
  let sum = 0
  xs.forEach((x) => {
    sum += x
  })
  return sum
}

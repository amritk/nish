// An arrow that writes `: void` itself may not answer a value from its concise
// body, as `tsc` rules; one that leaves the type to its context may.
const twice = (x: i32): i32 => x * 2

export const main = (): i32 => {
  const xs: i32[] = [1]
  xs.forEach((x): void => twice(x))
  return 0
}

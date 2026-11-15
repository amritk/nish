// `forEach` answers `void`, so it cannot be passed as an argument.
const take = (n: i32): i32 => n

export const main = (): i32 => {
  const xs: i32[] = [1]
  return take(xs.forEach((x) => console.log(x)))
}

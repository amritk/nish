// `forEach` answers `void`, so its answer cannot be bound.
export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3]
  const r = xs.forEach((x) => console.log(x))
  return r
}

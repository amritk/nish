// `forEach` on a `Set` answers `void`, so its answer cannot be bound.
export const main = (): i32 => {
  const s = new Set<i32>()
  const r = s.forEach((x) => console.log(x))
  return 0
}

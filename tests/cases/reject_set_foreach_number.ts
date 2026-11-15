// `forEach` on a `Set` takes a function; a number is refused.
export const main = (): i32 => {
  const s = new Set<i32>()
  s.forEach(1)
  return s.size
}

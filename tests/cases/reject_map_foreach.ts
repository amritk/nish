// `forEach` takes a function; a number is refused.
export const main = (): i32 => {
  const m = new Map<string, i32>()
  m.forEach(1)
  return m.size
}

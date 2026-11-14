// `forEach` on a `Map` is a method: named without a call it is refused.
export const main = (): i32 => {
  const m = new Map<string, i32>()
  const f = m.forEach
  return m.size
}

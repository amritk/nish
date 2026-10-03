// NL2367: `m.get(k)` may be missing and cannot be an operand of arithmetic, so
// the fix gives it the zero of the value type with `??`, parenthesised
// because `??` binds looser than `+`; a `get` already in parentheses is
// defaulted inside them.
export const test = (): number => {
  const counts = new Map<string, i32>()
  counts.set("a", 4)
  const one = (counts.get("a") ?? 0) + 1
  const two = 2 * (counts.get("b") ?? 0)
  return one + two
}

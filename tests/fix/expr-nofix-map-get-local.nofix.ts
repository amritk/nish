// NL2361: only a `m.get(k)` itself is defaulted; a `const` already bound to
// one can be narrowed, so a `let` copying it has no fix.
export const test = (): number => {
  const counts = new Map<string, i32>()
  const found = counts.get("a")
  let n = found
  return 0
}

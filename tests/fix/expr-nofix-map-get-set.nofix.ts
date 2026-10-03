// NL2361: a `Set` has no zero that stands in for a missing value, so a
// `m.get(k)` of one held in a `let` has no fix.
export const test = (): number => {
  const groups = new Map<string, Set<i32>>()
  let group = groups.get("a")
  return 0
}

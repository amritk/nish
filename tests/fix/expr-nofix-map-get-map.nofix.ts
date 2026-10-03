// NL2361: a `Map` has no zero that stands in for a missing value, so a
// `m.get(k)` of one held in a `let` has no fix.
export const test = (): number => {
  const nested = new Map<string, Map<string, i32>>()
  let inner = nested.get("a")
  return 0
}

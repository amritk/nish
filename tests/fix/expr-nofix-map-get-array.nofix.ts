// NL2361: an array has no zero that stands in for a missing value, so a
// `m.get(k)` of one held in a `let` has no fix.
export const test = (): number => {
  const lists = new Map<string, i32[]>()
  let xs = lists.get("a")
  return 0
}

// NL2361: a class has no zero that stands in for a missing value, so a
// `m.get(k)` of one held in a `let` has no fix.
class Cell {
  value: i32 = 0
}
export const test = (): number => {
  const cells = new Map<string, Cell>()
  let c = cells.get("a")
  return 0
}

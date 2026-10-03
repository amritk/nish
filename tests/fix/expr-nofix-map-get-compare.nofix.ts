// NL2367: a missing `m.get(k)` compares unequal to `0` and a defaulted one
// equal, so a comparison is not arithmetic and has no fix.
export const test = (): number => {
  const counts = new Map<string, i32>()
  const zero = counts.get("a") === 0
  return zero ? 1 : 0
}

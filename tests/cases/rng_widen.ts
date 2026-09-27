// WP31 §7: every operator reads a ranged value as its base, `i32`, so nothing
// computes a range. A `const` keeps the range of what it copies and a `let`
// without an annotation widens to `i32`, because it will be reassigned, so
// `widened + 100` is stored with no check. Arithmetic is `add nsw`, the index
// is an `i32` index, `toI64` is a `sext` and the template hole prints an `i32`.
export const main = (): number => {
  const low: integer<0, 9> = 7
  const kept = low
  let widened = low
  widened = widened + 100
  const sum = low + kept
  const wide: i64 = toI64(low)
  const xs = [5, 6, 7, 8, 9, 10, 11, 12]
  console.log(`${kept} ${widened} ${sum} ${wide} ${xs[low]} ${low < 9} ${-low}`)
  return 0
}

// NL2385: `new Array<integer<Lo, Hi>>(n)` for a range that does not hold 0.
export const main = (): i32 => {
  const months = new Array<integer<1, 12>>(3)
  return months.length
}

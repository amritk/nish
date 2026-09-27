// WP31: `new Array<T>(n)` zero-fills, and 0 is not a value of `integer<1, 9>`,
// so the array would hold what its type says it cannot, as a zero-filled
// `string[]` would hold nulls.
export const main = (): number => {
  const xs = new Array<integer<1, 9>>(4)
  return xs[0]
}

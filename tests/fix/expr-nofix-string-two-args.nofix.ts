// NL2247: JavaScript ignores a second argument to `String`, and a fix that
// dropped it would drop whatever it computes; there is none.
export const test = (): number => {
  const s = String(3, 4)
  return s.length
}

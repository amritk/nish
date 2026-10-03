// NL2247: `String()` with no argument is `""`, not a conversion, so it has no
// template-literal fix.
export const test = (): number => {
  const s = String()
  return s.length
}

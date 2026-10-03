// NL2367: `+` on a string `m.get(k)` is concatenation, not arithmetic, and
// `tsc` would print `undefined` where a default prints nothing; no fix.
export const test = (): number => {
  const names = new Map<i32, string>()
  const s = names.get(1) + "!"
  return s.length
}

// NL2247: the call is refused before its argument is checked, so the fix sees
// the type only of a local or a literal; `String(n + 1)` gets none rather
// than a guess.
export const test = (): number => {
  const n: i32 = 1
  const s = String(n + 1)
  return s.length
}

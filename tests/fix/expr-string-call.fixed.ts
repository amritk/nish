// NL2247: `String(x)` is not a function in Nish, and its fix is the template
// literal `tsc` reads as the same string, with the argument as its one hole:
// a local or a literal whose type a hole takes — a number, a boolean or a
// string — with its parentheses dropped.
export const test = (): number => {
  const n: i32 = 42
  const ok = true
  const a = `${n}`
  const b = `${ok}`
  const c = `${"s"}`
  console.log(`${a} ${b} ${c}`)
  return 0
}

// NL2249: `toString` is not a method of a number or a boolean, and with no
// argument its fix is the template literal. A parenthesised receiver loses its
// parentheses inside the hole.
export const test = (): number => {
  const n: i32 = 7
  const x: f64 = 1.5
  const ok = true
  const a = `${n}`
  const b = `${n + 1}`
  const c = `${x}`
  const d = `${ok}`
  console.log(`${a} ${b} ${c} ${d}`)
  return 0
}

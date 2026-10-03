// NL2247: `String(x)` is not a function in Nish, and its fix is the template
// literal `tsc` reads as the same string, with the argument as its one hole.
export const test = (): number => {
  const n: i32 = 42
  const a = `${n}`
  const b = `${n + 1}`
  console.log(`${a} ${b}`)
  return 0
}

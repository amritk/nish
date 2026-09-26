// A semicolon is only optional at a line break: two statements on one line
// still need one between them, as in TypeScript.
export const main = (): number => {
  const a: i32 = 1 const b: i32 = 2
  console.log(`${a + b}`)
  return 0
}

// A variable named `try`, then `try` alone on a line before a block, then
// `catch(n)` and a block on the next line. With no semicolon, these are the
// tokens of an Allman `try`/`catch`, and the rule is that a handler after the
// block makes `try` the statement: so this is refused (NL1033), although
// 0.13.0 read it as a name, a block, a call and another block. It is the one
// program that stopped compiling (docs/LANGUAGE.md, Rejected statements).
function catch(x: i32): void {}
export const main = (): i32 => {
  let try: i32 = 5
  let n: i32 = 0
  try
  {
    n = n + try
  }
  catch(n)
  {
    n = n + 100
  }
  return n
}

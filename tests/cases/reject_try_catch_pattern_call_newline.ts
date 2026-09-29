// The array-pattern twin of `reject_try_catch_call_newline`: `catch([n])` and a
// block on the next line are the tokens of an Allman `try`/`catch` whose
// binding is the pattern `[n]`, so the handler rule reads the `try` statement
// (NL1033). A literal argument, `catch([1, 2])`, is no binding and stays a
// call (`tests/parser/names-catch-array.ts`).
function catch(xs: i32[]): void {}
export const main = (): i32 => {
  let try: i32 = 5
  let n: i32 = 0
  try
  {
    n = n + try
  }
  catch([n])
  {
    n = n + 100
  }
  return n
}

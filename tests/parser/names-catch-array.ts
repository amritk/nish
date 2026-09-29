// A sibling of `names.ts`: a call of a function named `catch` whose argument
// is an array literal, right after a block under a variable named `try`. A
// literal is not a catch binding, so `catch([1, 2])` is no handler and this
// compiles as it did on 0.13.0. A file of its own because `names.ts` declares
// a `catch` of another type; not TypeScript (`tsc` reserves `try` and
// `catch`), so it lives here.
function catch(xs: i32[]): i32 {
  return xs.length
}

export const test = (): i32 => {
  let try: i32 = 1
  try
  {
    try = try + 1
  }
  catch([1, 2]);
  return try
}

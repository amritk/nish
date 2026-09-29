// A sibling of `names.ts`: a call of a function named `catch` whose argument
// is an object literal, right after a block under a variable named `try`. A
// key bound to a literal is not a catch binding, so `catch({ first: 1,
// second: 2 })` is no handler and this compiles as it did on 0.13.0.
interface Pair {
  first: i32
  second: i32
}

function catch(p: Pair): i32 {
  return p.first + p.second
}

export const test = (): i32 => {
  let try: i32 = 1
  try
  {
    try = try + 1
  }
  catch({ first: 1, second: 2 });
  return try
}

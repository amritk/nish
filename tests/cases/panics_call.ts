// Panic sites: a call into a function that may panic is a `call` site of the
// caller, two calls deep as well as one, and names the callee and the kind
// it reaches; a call into a clean function is not a site.
const pick = (xs: i32[], i: i32): i32 => xs[i]

const viaOne = (xs: i32[], i: i32): i32 => pick(xs, i) + 1

const viaTwo = (xs: i32[], i: i32): i32 => viaOne(xs, i) * 2

const add = (a: i32, b: i32): i32 => a + b

const clean = (a: i32): i32 => add(a, 1)

export const main = (): number => {
  const xs: i32[] = [4, 5]
  console.log(viaTwo(xs, parseInt("1")))
  console.log(clean(9))
  return 0
}

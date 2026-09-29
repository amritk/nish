// The functions of `names-declarations.ts`: a function named after each word
// TypeScript reads as a declaration modifier or keyword, called in every
// position a call can stand, including the ones that look like the
// declaration — `async (x)` is a call here, as it was before WP33 R1 read
// `async` arrows, because no `=>` follows it (`Parser.asyncArrowAhead`), and
// `async` before a parenthesis on the next line is a call too. `tests/run.js`
// reads each call out of the IR.
const async = (x: i32): i32 => x + 1

const namespace = (x: i32): i32 => x + 2

const module = (x: i32): i32 => x + 3

const declare = (x: i32): i32 => x + 4

const global = (x: i32): i32 => x + 5

const keyof = (x: i32): i32 => x + 6

const type = (x: i32): i32 => x + 7

const through = (x: i32): i32 => async(module(x))

// A top-level function value is a callee a parameter can name (WP29), so
// `async` is passed here as the name it is.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x)

export const test = (): i32 => {
  let n: i32 = async(1) + namespace(2) + module(3) + declare(4) + global(5)
  n = n + keyof(6) + type(7)
  async (n)
  async(n)
  namespace
  (n)
  module(n)
  declare(n)
  global(n)
  n = async
  (n)
  n = async (async(n))
  n = through(n) + apply(async, n)
  const s = `${async(1)}${module(2)}${type(3)}`
  return n + s.length
}

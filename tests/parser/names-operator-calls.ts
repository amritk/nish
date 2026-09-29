// The functions of `names-operators.ts`: a function named after each word
// TypeScript reads as an operator, called in every position a call can stand,
// including the ones TypeScript would read as the operator — `typeof(n)` and
// `void (0)` are calls here, as they were before WP33 R1 parsed the
// operators, because a name followed by `(` is always a call to this parser
// (`Parser.operandAhead`). `tests/run.js` reads each call out of the IR.
function typeof(x: i32): i32 {
  return x + 1
}

function delete(x: i32): i32 {
  return x + 2
}

function void(x: i32): i32 {
  return x + 3
}

function instanceof(x: i32): i32 {
  return x + 4
}

function in(x: i32): i32 {
  return x + 5
}

function yield(x: i32): i32 {
  return x + 6
}

function await(x: i32): i32 {
  return x + 7
}

function satisfies(x: i32): i32 {
  return x + 8
}

function as(x: i32): i32 {
  return x + 9
}

function of(x: i32): i32 {
  return x + 10
}

const through = (x: i32): i32 => in(instanceof(x))

export const test = (): i32 => {
  let n: i32 = typeof(1) + delete(2) + void(3) + instanceof(4) + in(5)
  n = n + yield(6) + await(7) + satisfies(8) + as(9) + of(10)
  typeof(n)
  void (0)
  delete(n)
  await(n)
  yield(n)
  n = n
  in(n)
  n = n
  instanceof(n)
  n = n
  as(n)
  n = n
  satisfies(n)
  n = typeof(typeof(n))
  n = void (n) + await (1)
  n = through(n)
  const s = `${typeof(1)}${in(2)}${as(3)}`
  return n + s.length
}

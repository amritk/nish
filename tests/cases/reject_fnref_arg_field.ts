// WP51 stage 2: a field holding a function reference, passed for a function
// parameter, would be read again at each call the callee makes, so a callee
// that stores into the field would reach the new function where JavaScript
// keeps the one passed. It is refused (NL2741): read it into a `const`.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1
const dbl = (x: i32): i32 => x * 2

class Box {
  op: F
  constructor(op: F) {
    this.op = op
  }
}

const swapThen = (b: Box, f: (x: i32) => i32, x: i32): i32 => {
  b.op = dbl
  return f(x)
}

export const main = (): void => {
  const b = new Box(inc)
  console.log(`${swapThen(b, b.op, 3)}`)
}

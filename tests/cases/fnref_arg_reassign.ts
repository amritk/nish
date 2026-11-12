// WP51 stage 2: a reference read from a field into a `const` and passed for a
// function parameter is the function the call passed, even when the callee
// stores a different one into that field before calling it: natively and
// under Node, `swapThen` calls `inc` and then the field holds `dbl`.
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
  const op = b.op
  const first = swapThen(b, op, 3)
  const now = b.op
  console.log(`${first} ${now(3)}`)
}

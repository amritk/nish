// A reference held in a field: the field is an `i32` tag, and `this.op(x)`
// is a direct call of the dispatcher for `Op`'s set, which switches on the
// tag and tail-calls the function it names.
type Op = (x: i32) => i32

const double = (x: i32): i32 => x * 2
const negate = (x: i32): i32 => 0 - x

class Stage {
  op: Op
  constructor(op: Op) {
    this.op = op
  }
  run(x: i32): i32 {
    return this.op(x)
  }
}

export const both = (x: i32): i32 => {
  const s = new Stage(double)
  const a = s.run(x)
  s.op = negate
  return a + s.run(x)
}

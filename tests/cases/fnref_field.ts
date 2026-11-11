// WP51 stage 1: a field holds a reference to a capture-free top-level
// function, given in the constructor and replaced later. `this.op(x)` lowers
// to a direct call of the field's dispatcher, a `switch` over the field's set.
type Op = (x: i32) => i32

const double = (x: i32): i32 => x * 2
const negate = (x: i32): i32 => -x

class Stage {
  op: Op
  constructor(op: Op) {
    this.op = op
  }
  run(x: i32): i32 {
    return this.op(x)
  }
}

export const main = (): void => {
  const s = new Stage(double)
  console.log(`${s.run(5)}`)
  s.op = negate
  console.log(`${s.run(5)}`)
}

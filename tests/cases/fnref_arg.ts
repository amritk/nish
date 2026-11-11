// WP51 stage 2: a function reference held in a local, a `let`, a field, an
// element or `this`'s field is passed for an inline function-typed parameter.
// The call passes an arrow that calls the reference, so `apply` is
// instantiated per call and calls through the place's dispatcher.
type F = (x: i32) => i32;

const square = (x: i32): i32 => x * x;
const plus1 = (x: i32): i32 => x + 1;
const neg = (x: i32): i32 => 0 - x;

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);
const twice = (f: (x: i32) => i32, x: i32): i32 => f(f(x));

class Box {
  op: F;
  constructor(op: F) {
    this.op = op;
  }
  run(x: i32): i32 {
    return twice(this.op, x);
  }
}

export const main = (): void => {
  const c: F = square;
  let r: F = square;
  if (apply(plus1, 0) > 0) {
    r = plus1;
  }
  const b = new Box(neg);
  const ops: F[] = [square, plus1];
  console.log(`${apply(c, 3)} ${apply(r, 3)} ${apply(b.op, 3)} ${apply(ops[0], 5)} ${apply(ops[1], 5)}`);
  console.log(`${b.run(4)} ${twice(ops[1], 1)}`);
};

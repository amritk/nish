// WP51 stage 2: a function reference held in a local or a `let`, or read
// from a field, an element or `this`'s field into a `const`, is passed for an
// inline function-typed parameter. The call passes an arrow that calls the
// reference, so `apply` is instantiated per call and calls through the
// place's dispatcher.
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
    const op = this.op;
    return twice(op, x);
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
  const field = b.op;
  const first = ops[0];
  const second = ops[1];
  console.log(`${apply(c, 3)} ${apply(r, 3)} ${apply(field, 3)} ${apply(first, 5)} ${apply(second, 5)}`);
  console.log(`${b.run(4)} ${twice(second, 1)}`);
};

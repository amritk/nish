// NL2759: a field of function reference type passed for a function parameter
// would be read again at each call the callee makes; pass a `const` instead.
type F = (x: i32) => i32;

const inc = (x: i32): i32 => x + 1;

class Box {
  op: F;
  constructor(op: F) {
    this.op = op;
  }
}

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  const b = new Box(inc);
  return apply(b.op, 2);
};

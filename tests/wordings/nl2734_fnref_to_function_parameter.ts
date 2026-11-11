// NL2734: a reference passed where a function parameter is. The parameter
// names the callee a call is compiled for, and a reference is known only at
// run time; passing one is the next stage of function references.
const double = (x: i32): i32 => x * 2;

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  const h = double;
  return apply(h, 2);
};

// NL2719: a function that takes a function parameter, named as a value. It is
// a template compiled once per callee, so there is no single body to tag.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  const g = apply;
  return 0;
};

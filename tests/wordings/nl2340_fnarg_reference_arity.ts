// NL2340: a function reference passed for a function parameter of another
// parameter count.
type G = (x: i32, y: i32) => i32;

const add = (x: i32, y: i32): i32 => x + y;

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  const g: G = add;
  return apply(g, 2);
};

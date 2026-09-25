// WP29: the argument must name a top-level function or be an arrow written
// at the call; a local holds a value, and a function is never one.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  const n = 4;
  return apply(n, 2);
};

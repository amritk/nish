// WP29: the argument must name a top-level function, be an arrow written at
// the call, or (WP51 stage 2) hold a function reference; a local of any other
// type holds a value, and the refusal names its type.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  const n = 4;
  return apply(n, 2);
};

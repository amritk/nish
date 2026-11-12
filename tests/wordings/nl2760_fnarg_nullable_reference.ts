// NL2760: a nullable function reference passed for a function parameter
// before a test has narrowed it.
type F = (x: i32) => i32;

const inc = (x: i32): i32 => x + 1;

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  let h: F | null = null;
  h = inc;
  return apply(h, 2);
};

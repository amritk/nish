// Only an arrow written directly in a function's body captures: an arrow
// inside another arrow may read only its own parameters.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);
export const main = (): i32 => {
  const k = 3;
  return apply((x) => apply((y) => y + k, x), 1);
};

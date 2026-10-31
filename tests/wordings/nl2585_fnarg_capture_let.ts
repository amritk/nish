// NL2585: an arrow argument reads a `let`, whose value may change after the
// arrow is handed what it captures.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  let k = 1;
  k = k + 1;
  return apply((x) => x + k, 1);
};

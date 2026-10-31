// A `let` may change after the arrow is made, so an arrow argument does not
// read one; `nish --fix` copies it into a `const` just before the call.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  let k = 1;
  k = k + 1;
  return apply((x) => x + k, 1);
};

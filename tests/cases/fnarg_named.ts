// WP29 (wp23 §6): a function-typed parameter makes `apply` a template, and a
// top-level function named for it is part of the instantiation's key. Two
// callees are two `define`s, each calling its callee directly: there is no
// function pointer, no indirect call and no parameter for `f` in the IR.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x) + 1;

const square = (x: i32): i32 => x * x;
const cube = (x: i32): i32 => x * x * x;

export const main = (): i32 => {
  console.log(`${apply(square, 3)} ${apply(cube, 3)} ${apply(square, 4)}`);
  return 0;
};

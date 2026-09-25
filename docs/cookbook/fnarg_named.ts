// A function-typed parameter makes `apply` a template over its callee: one
// `define` per function argument, each calling its callee directly.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x) + 1;

const square = (x: i32): i32 => x * x;
const cube = (x: i32): i32 => x * x * x;

export const both = (x: i32): i32 => apply(square, x) + apply(cube, x);

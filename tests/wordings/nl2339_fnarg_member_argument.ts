// NL2339: a function argument that is neither a top-level function nor an
// arrow written at the call; a member access computes a value.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => apply(Math.abs, -2);

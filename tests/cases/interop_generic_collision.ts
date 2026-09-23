// WP18 G8: a declared function whose name is what `identity<i32>` used to be
// spelled in C. Before G8 the header declared `identity_i32` twice, once as
// the user's `(x) => x + 1` and once bound to `identity$i32`, and did not
// compile. An instantiation's C name now starts with the reserved `nish_gen_`,
// so the two cross as two functions; tests/run.js compiles the header under
// -pedantic and calls both from C.
export const identity = <T>(x: T): T => x;

export const identity_i32 = (x: i32): i32 => x + 1;

export const test = (): number => identity(40) + identity_i32(1);

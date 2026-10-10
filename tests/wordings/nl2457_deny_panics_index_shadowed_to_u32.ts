// --deny-panics refuses a `u32` index the checker cannot prove in range, and
// names no guard: the module declares its own `toU32`, which the credited
// `toU32(i) < toU32(xs.length)` would call instead of the builtin.
const toU32 = (x: i32): i32 => x

export const at = (xs: i32[], i: u32): i32 => xs[i] + toU32(0);

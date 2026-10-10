// #461: --deny-panics refuses an unsigned index the checker cannot prove in
// range, and names the guard it credits for one: `i >= 0 && i < xs.length`
// does not type-check against a `u32`, and its type is already the lower end.
export const at = (xs: i32[], i: u32): i32 => xs[i];

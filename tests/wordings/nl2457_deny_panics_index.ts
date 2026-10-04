// --deny-panics refuses an index the checker cannot prove in range, and the
// error names the guard that would prove it.
export const at = (xs: i32[], i: i32): i32 => xs[i];

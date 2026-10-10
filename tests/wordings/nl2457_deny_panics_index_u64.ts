// --deny-panics refuses a `u64` index the checker cannot prove in range, and
// names no guard: none both type-checks against the length and is credited.
export const at = (xs: i32[], i: u64): i32 => xs[i];

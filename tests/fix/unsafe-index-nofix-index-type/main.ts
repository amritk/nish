// `uncheckedGet` takes an i32 index. A u8 or an i64 index is not one, so both
// sites are reported without a fix.
export const sum = (xs: i32[], b: u8, n: i64): i32 => xs[b] + xs[n]

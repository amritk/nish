// --deny-panics bounds `w >>> k` on a u32 only for a count below 32: the
// count is taken mod 32, so `w >>> 32` is `w` and `+ 1` on it stays checked.
export const f = (w: u32): i32 => toI32(w >>> 32) + 1;

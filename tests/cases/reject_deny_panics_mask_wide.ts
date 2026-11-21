// --deny-panics reads `w >>> 1` on a u32 as [0, 2^31 - 1], which is all of
// i32's non-negative half, so `+ 1` on it may overflow and stays checked.
export const f = (w: u32): i32 => toI32(w >>> 1) + 1;

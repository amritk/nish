// --deny-panics bounds `w >>> k` on a u32 only for a count of at least one:
// `w >>> 0` is `w` itself, so `+ 1` on its conversion stays checked.
export const f = (w: u32): i32 => toI32(w >>> 0) + 1;

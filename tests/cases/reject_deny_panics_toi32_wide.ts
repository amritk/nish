// --deny-panics reads `toI32(w)` on a bare u32 as any i32: the conversion
// keeps the low 32 bits, so `+ 1` on it may overflow and stays checked.
export const f = (w: u32): i32 => toI32(w) + 1;

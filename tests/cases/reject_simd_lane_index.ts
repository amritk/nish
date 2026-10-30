// A lane index is an integer literal in range: `extract` and `replace` at a
// constant lane are one instruction and need no check at run time.
import { f64x2, i32x4, u8x16, extract, replace } from "nish:simd";

export const f = (v: i32x4, k: i32): i32 => extract(v, k);
export const g = (v: i32x4): i32 => extract(v, 4);
export const h = (v: u8x16): u8x16 => replace(v, 16, 0);
export const j = (v: f64x2): f64 => extract(v, -1);
export const m = (v: f64x2): f64 => extract(v, 1.0);

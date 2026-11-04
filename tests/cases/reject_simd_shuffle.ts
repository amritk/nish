// `shuffle(a, b, ...)` takes two vectors of one type and one lane index for
// each lane of the result, each an integer literal naming one of the 2N
// lanes of `a` then `b`.
import { i32x4, u8x16, shuffle } from "nish:simd";

export const f = (a: i32x4, b: i32x4): i32x4 => shuffle(a, b, 0, 1, 2);
export const g = (a: i32x4, b: i32x4): i32x4 => shuffle(a, b, 0, 1, 2, 8);
export const h = (a: i32x4, b: i32x4, k: i32): i32x4 => shuffle(a, b, 0, 1, 2, k);
export const j = (a: i32x4): i32x4 => shuffle(a);
export const k = (a: i32x4, b: u8x16): i32x4 => shuffle(a, b, 0, 1, 2, 3);

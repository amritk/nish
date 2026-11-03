// Each lane operation takes the operands of its family, of one type: float
// arithmetic a float vector (an integer lane wraps, so its form is
// `addWrapping`), the integer forms an integer vector, the bitwise forms an
// integer vector or a mask, `any`/`all`/`bitmask` a mask, and `select` the
// mask a compare of its vectors answers. Two vectors of different types are
// reinterpreted first.
import { i32x4, u32x4, f32x4, f64x2, u8x16, add, mul, sqrt, addWrapping, and, any, select, eq, min } from "nish:simd";

export const f = (a: i32x4): i32x4 => add(a, a);
export const g = (a: u8x16): u8x16 => mul(a, a);
export const h = (a: i32x4): i32x4 => sqrt(a);
export const j = (a: f32x4): f32x4 => addWrapping(a, a);
export const k = (a: f32x4): f32x4 => and(a, a);
export const m = (a: i32x4): boolean => any(a);
export const n = (a: i32x4, b: u32x4): i32x4 => min(a, b);
export const p = (a: f64x2, b: i32x4): i32x4 => select(eq(a, a), b, b);
export const q = (a: i32x4): i32 => add(a);

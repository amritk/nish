// `sum` widens: a `u8x16` or `u16x8` sum is an `i32` that cannot overflow,
// a float sum is ordered. A 32-bit integer sum can overflow, so it is
// `sumWrapping`, which only a 32-bit vector has.
import { i32x4, u8x16, f32x4, sum, sumWrapping } from "nish:simd";

export const f = (a: i32x4): i32 => sum(a);
export const g = (a: u8x16): i32 => sumWrapping(a);
export const h = (a: f32x4): f32 => sumWrapping(a);

// A buffer crosses only as an array whose elements have one layout on every
// target: `u8`, `u16`, `u32`, `i32` or `f32` (WP89 S2). An `f64` or `i64`
// is 4-byte aligned inside an i386 struct and 8-byte aligned elsewhere, so
// `readonly f64[]` is refused.
declare function sum(xs: readonly f64[], n: u64): f64;

export const main = (): i32 => 0;

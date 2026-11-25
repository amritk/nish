// WP89 S2: the count after an `f32[]` is an element count, a `u64`, as after
// a `u8[]`. An `i32` count could be negative, so it is refused.
declare function sum_f32(xs: readonly f32[], n: i32): f32

export const main = (): i32 => 0

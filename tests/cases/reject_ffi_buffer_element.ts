// Only `u8` crosses as a buffer. An `i32[]` would raise endianness and
// alignment questions on the C side that no program asks yet, so the only
// arrays a declared C function takes are `u8[]` and `readonly u8[]`.
declare function sum(xs: readonly i32[], n: u64): i32;

export const main = (): i32 => 0;

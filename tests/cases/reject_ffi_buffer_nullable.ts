// A null buffer has no length for the count to be held to. The `NULL, 0`
// call C allows is written with a `CPtr | null` parameter instead, whose
// literal `null` the call passes.
declare function write(fd: i32, buf: u8[] | null, n: u64): i64;

export const main = (): i32 => 0;

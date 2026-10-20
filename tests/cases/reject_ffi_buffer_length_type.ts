// The parameter after a run of buffers is their count, and it is a `u64`: a
// byte count of a C `size_t`. An `i32` there could be negative, and a
// `CPtr` there would leave the run with no count at all, so both are refused
// by the one rule rather than the second being read as the next parameter.
declare function write(fd: i32, buf: readonly u8[], n: i32): i64;

export const main = (): i32 => 0;

// `syscall` is refused by its name: it is variadic in C, so a fixed arity
// calls it through the wrong ABI on some targets, and it bypasses the libc
// wrappers the rest of the program goes through.
declare function syscall(n: i64, a: i64, b: i64): i64;

export const main = (): i32 => 0;

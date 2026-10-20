// WP40 B1.1: the refusal of a call to a buffer-taking `declare function` holds
// for a call through a compile-time function parameter bound to it, as it does
// for a call that names it (`reject_ffi_buffer_call`).
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

function via(f: (fd: i32, buf: readonly u8[], n: u64) => i64): i64 {
  const b: u8[] = [104, 105, 10];
  return f(1, b, 3);
}

export function main(): i32 {
  via(write);
  return 0;
}

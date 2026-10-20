// WP40 B1.2: a `readonly u8[]` passed to `write` reaches C as its data
// pointer. The first call passes the array's own length, which the compiler
// proves, so no check runs; the second passes a literal prefix, so one
// `ffi-length` check compares 3 against the length first. Every line goes
// through `write`, so none interleaves with `console.log`'s buffer.
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

export function main(): i32 {
  const bytes: u8[] = [104, 101, 108, 108, 111, 10];
  write(1, bytes, toU64(bytes.length));
  const prefix: u8[] = [104, 105, 10, 33];
  write(1, prefix, 3);
  return 0;
}

// WP40 B1.2: a count a `declare function` call passes past the buffer's
// length stops the program before C runs: an `ffi-length` panic, exit 1.
// `fits` passes a literal 3 for three bytes, so its check runs and holds.
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

export function fits(): i32 {
  const b: u8[] = [111, 107, 10];
  return toI32(write(1, b, 3));
}

export function over(): i32 {
  const b: u8[] = [110, 111];
  return toI32(write(1, b, 3));
}

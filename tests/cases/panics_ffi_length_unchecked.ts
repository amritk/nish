// WP40 B1.2: `--unchecked-indexing` drops index bounds checks, not the
// `ffi-length` check: C cannot check a count, so the boundary keeps it. The
// same program as `panics_ffi_length`, compiled with the flag.
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

export function fits(): i32 {
  const b: u8[] = [111, 107, 10];
  return toI32(write(1, b, 3));
}

export function over(): i32 {
  const b: u8[] = [110, 111];
  return toI32(write(1, b, 3));
}

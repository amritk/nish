// WP40 B1.2: a `pop` written inline in a later argument shrinks the buffer
// after its length was read for the count; the check reads the length again
// after every argument, compares 4 against 3, and fails.
declare function pwrite(fd: i32, buf: readonly u8[], n: u64, off: i64): i64;

export function inlinePop(): i32 {
  const buf: u8[] = [1, 2, 3, 4];
  return toI32(pwrite(-1, buf, toU64(buf.length), toI64(buf.pop())));
}

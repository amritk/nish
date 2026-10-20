// WP40 B1.2: the count is a `u64` and the check compares it unsigned, so a
// count that wrapped below zero is the largest count there is, not a negative
// one under the length: `icmp ule`, and the check fails.
declare function read(fd: i32, buf: u8[], n: u64): i64;

export function wrapped(): i32 {
  const buf = new Array<u8>(8);
  return toI32(read(0, buf, toU64(0) - toU64(1)));
}

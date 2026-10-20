// WP40 B1.2: `memcpy` takes a run of two buffers that one count closes, and
// the count is checked against each. Counting `dst`'s own length proves
// `dst`'s check and leaves `src`'s, which holds here: `src` is the longer.
declare function memcpy(dst: u8[], src: readonly u8[], n: u64): CPtr;
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

export function main(): i32 {
  const dst = new Array<u8>(4);
  const src: u8[] = [99, 112, 121, 10, 33];
  memcpy(dst, src, toU64(dst.length));
  write(1, dst, toU64(dst.length));
  return 0;
}

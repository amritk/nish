// WP40 B1.2: a `u8[]` passed to `read` is written by C in place, and the bytes
// it wrote are the array's own afterwards. The count is the buffer's length,
// proven, so the call carries no check. The buffer is made inside the call's
// arena scope and released with it, which is sound because C borrows the
// pointer only for the call.
declare function read(fd: i32, buf: u8[], n: u64): i64;
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

function echo(fd: i32): i64 {
  const buf = new Array<u8>(64);
  const n = read(fd, buf, toU64(buf.length));
  if (n > 0) {
    write(1, buf, toU64(n));
  }
  return n;
}

export function run(fd: i32): i32 {
  return toI32(echo(fd));
}

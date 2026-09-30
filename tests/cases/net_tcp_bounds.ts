// WP34 N5: `netRead` and `netWrite` check `0 <= off <= off + len <=
// buf.length` before the call, through the slice panic `set` uses and with its
// words. In range, the call reaches the runtime, which answers -9 for the
// closed descriptor; `net_tcp_bounds.c` runs each range that is not in a
// child and prints its message and its exit status.
const readAt = (off: i32, len: i32): i32 => {
  const buf: u8[] = new Array<u8>(8);
  return netRead(-1, buf, off, len);
};

const writeAt = (off: i32, len: i32): i32 => {
  const buf: u8[] = [1, 2, 3, 4, 5, 6, 7, 8];
  return netWrite(-1, buf, off, len);
};

export const pastEnd = (): i32 => readAt(4, 5);

export const negativeOffset = (): i32 => writeAt(-1, 2);

export const negativeLength = (): i32 => readAt(2, -1);

export const test = (): i32 => readAt(0, 8) + writeAt(8, 0);

// WP44: `fileReadAt` checks `0 <= off <= off + len <= buf.length` before the
// call, through the slice panic `netRead` uses and with its words. In range,
// the call reaches the runtime, which answers -9 for the descriptor -1, and 0
// for the empty window at the end without asking the kernel;
// `file_read_at_bounds.c` runs each range that is not in a child and prints
// its message and its exit status.
const readAt = (off: i32, len: i32): i32 => {
  const buf: u8[] = new Array<u8>(8);
  const pos: i64 = 0;
  return fileReadAt(-1, buf, off, len, pos);
};

export const pastEnd = (): i32 => readAt(4, 5);

export const negativeOffset = (): i32 => readAt(-1, 2);

export const negativeLength = (): i32 => readAt(2, -1);

export const test = (): i32 => readAt(0, 8) + readAt(8, 1 - 1);

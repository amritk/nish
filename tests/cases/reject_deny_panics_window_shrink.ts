// --deny-panics keeps the window check of a buffer call when a later argument
// calls something: `buf.length` is read where it is written, the check reads
// the length after every argument, and `shrink(buf)` empties the buffer in
// between, so `[0, 64)` of a buffer of length 0 must still panic.
const shrink = (b: u8[]): i64 => {
  while (b.length > 0) {
    b.pop();
  }
  return toI64(0);
};

export const readAll = (fd: i32, buf: u8[]): i32 => fileReadAt(fd, buf, 0, buf.length, shrink(buf));

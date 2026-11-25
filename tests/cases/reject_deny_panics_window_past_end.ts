// --deny-panics refuses a window whose guard leaves out `end <= buf.length`:
// `0 <= start <= end` alone lets `[start, end)` run past the buffer.
export const window = (buf: u8[], start: i32, end: i32): void => {
  if (start >= 0 && start <= end) {
    writeBytes(buf, start, end - start);
  }
};

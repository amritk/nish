// --deny-panics refuses a window whose guard leaves out `start <= end`:
// `end - start` may then be negative, and the window is not proven.
export const window = (buf: u8[], start: i32, end: i32): void => {
  if (start >= 0 && end <= buf.length) {
    writeBytes(buf, start, end - start);
  }
};

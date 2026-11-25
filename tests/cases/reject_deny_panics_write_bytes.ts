// --deny-panics refuses a `writeBytes` window whose offset and count are both
// locals: nothing relates `off + n` to the buffer's length.
export const emit = (buf: u8[], off: i32, n: i32): void => {
  if (off >= 0 && n >= 0 && off <= buf.length && n <= buf.length) {
    writeBytes(buf, off, n);
  }
};

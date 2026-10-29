// `writeBytes(bytes, off, len)` checks `0 <= off <= off + len <= bytes.length`
// before the call, through the slice panic `dst.set` uses and with its words,
// as `netWrite` does. In range the bytes reach stdout and the count is the
// answer; `io_write_bytes_bounds.c` runs each range that is not in a child and
// prints its message and its exit status.
const writeAt = (off: i32, len: i32): i32 => {
  const bytes: u8[] = [65, 66, 67, 10];
  return writeBytes(bytes, off, len);
};

export const pastEnd = (): i32 => writeAt(2, 3);

export const negativeOffset = (): i32 => writeAt(-1, 2);

export const negativeLength = (): i32 => writeAt(2, -1);

export const test = (): i32 => writeAt(1, 3) + writeAt(4, 0);

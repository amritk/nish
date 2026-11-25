// --deny-panics keeps the check of `String.fromBytes(buf, start, end)` when
// the guard says `start <= end <= buf.length` and nothing says `start >= 0`:
// a negative `start` would read before the array's first byte.
export const word = (buf: u8[], start: i32, end: i32): string => {
  if (start <= end && end <= buf.length) {
    return String.fromBytes(buf, start, end);
  }
  return "";
};

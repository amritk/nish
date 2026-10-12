// `String.fromBytes` checks `0 <= start <= end <= bytes.length` once, as
// `s.slice` checks its range, and fails through the same panic, which prints
// the range asked for. `str_from_bytes_oob.c` runs each in a child and prints
// its message and its exit status.
const cut = (start: i32, end: i32): i32 => {
  const bytes: u8[] = [97, 98, 99, 100];
  return toI32(String.fromBytes(bytes, start, end).length);
};

export const pastEnd = (): i32 => cut(2, 5);

export const reversed = (): i32 => cut(3, 1);

export const negative = (): i32 => cut(-1, 2);

export const test = (): i32 => cut(1, 4);

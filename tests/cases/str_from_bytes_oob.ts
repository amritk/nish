// `String.fromBytes` checks `0 <= start <= end <= bytes.length` once, as
// `s.slice` checks its range, and fails through the same panic, which prints
// the range asked for. `str_from_bytes_oob.c` runs each in a child and prints
// its message and its exit status. A `u32` end above 2^31 is widened with
// `zext`, so it is past the end rather than negative; a negative pair, and an
// `i64` start, fail the same unsigned compare.
const cut = (start: i32, end: i32): i32 => {
  const bytes: u8[] = [97, 98, 99, 100];
  return toI32(String.fromBytes(bytes, start, end).length);
};

export const pastEnd = (): i32 => cut(2, 5);

export const reversed = (): i32 => cut(3, 1);

export const negative = (): i32 => cut(-1, 2);

export const negativeEnd = (): i32 => cut(-2, -1);

export const wideEnd = (): i32 => {
  const bytes: u8[] = [97, 98, 99, 100];
  const end: u32 = 3000000000;
  return toI32(String.fromBytes(bytes, 0, end).length);
};

export const wideStart = (): i32 => {
  const bytes: u8[] = [97, 98, 99, 100];
  const start: i64 = toI64(-5);
  return toI32(String.fromBytes(bytes, start, 2).length);
};

export const test = (): i32 => cut(1, 4);

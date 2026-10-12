// `String.fromBytes` evaluates its three arguments left to right and reads the
// array's length and data only after all of them, as `u8[]`'s `set` does. So
// an end computed by a call that grows the array is checked against, and
// copied from, the grown array, and one computed by a call that shrinks it
// panics against the shrunk length. Read before the arguments, the first would
// panic and the second would copy bytes the array no longer holds.
const grow = (bytes: u8[]): i32 => {
  bytes.push(33);
  return toI32(bytes.length);
};

const shrink = (bytes: u8[]): i32 => {
  const n = toI32(bytes.length);
  bytes.pop();
  return n;
};

export const grown = (): i32 => {
  const bytes: u8[] = [104, 105];
  const s = String.fromBytes(bytes, 0, grow(bytes));
  return toI32(s.length) * 1000 + toI32(s.charCodeAt(2));
};

export const shrunk = (): i32 => {
  const bytes: u8[] = [104, 105];
  return toI32(String.fromBytes(bytes, 0, shrink(bytes)).length);
};

export const test = (): i32 => grown();

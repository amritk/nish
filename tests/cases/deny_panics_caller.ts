// --deny-panics proves a caller contract (#2296): `count` starts with
// `if (test) { panic(m) }` on its own parameters, so each call is a
// `contract` site its caller proves from its arguments, here a literal range
// of a buffer whose length the literal fixes and a range behind its test.
// Every call is proven, so `count`'s `panic` is its callers' and is proven
// too, and the program builds with no panic site left.
const count = (buf: u8[], start: i32, end: i32): i32 => {
  if (start < 0 || end < start || end > toI32(buf.length)) {
    panic("count: the range is outside the buffer");
  }
  return end - start;
};

const part = (buf: u8[], start: i32, end: i32): i32 => {
  if (start >= 0 && start <= end && end <= buf.length) {
    return count(buf, start, end);
  }
  return 0;
};

export const main = (): number => {
  const b: u8[] = [104, 105, 10];
  console.log(`${count(b, 0, 3)}`);
  console.log(`${part(b, 1, 3)}`);
  return 0;
};

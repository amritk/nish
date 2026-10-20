// A call to a declared C function that takes a buffer is refused until the
// release that lowers it: passing the bytes and holding the count to the
// array's length. The declaration itself is checked and accepted.
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

export const main = (): i32 => {
  const b: u8[] = [104, 105, 10];
  write(1, b, 3);
  return 0;
};

// NL2396: the source's elements are the receiver's own type, so the copy is
// bytes with no conversion; an `i32[]` into a `u8[]` would need one per element.
export const main = (): i32 => {
  const a: u8[] = [0, 0, 0, 0];
  const b: i32[] = [1];
  a.set(b);
  return 0;
};

// NL2397: `set` takes the source and an optional offset, nothing more.
export const main = (): i32 => {
  const a: u8[] = [0, 0];
  const b: u8[] = [1];
  a.set(b, 0, 1);
  return 0;
};

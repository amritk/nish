// NL2397: `set` takes a source and an optional offset.
export const main = (): i32 => {
  const a: u8[] = [0];
  a.set();
  return 0;
};

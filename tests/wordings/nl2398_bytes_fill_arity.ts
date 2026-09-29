// NL2398: `fill` takes a value and at most two ends.
export const main = (): i32 => {
  const a: u8[] = [0];
  a.fill(1, 0, 1, 2);
  return 0;
};

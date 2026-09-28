// NL2398: `fill` takes the value and up to two ends; without a value there is
// nothing to fill with.
export const main = (): i32 => {
  const a: u8[] = [0, 0];
  a.fill();
  return 0;
};

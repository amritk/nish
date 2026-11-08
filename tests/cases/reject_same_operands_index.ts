// The same element on both sides of `-` is always zero (NL2692).
export const main = (): i32 => {
  const xs: i32[] = [5, 9];
  const i: i32 = 1;
  return xs[i] - xs[i];
};

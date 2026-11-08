// `x < x` is false for every f64, NaN included, so the floating-point
// exemption for `!==` does not reach it (NL2692).
export const main = (): i32 => {
  const x: f64 = toF64(3);
  if (x < x) {
    return 1;
  }
  return 0;
};

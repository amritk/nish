// The parser rounded the literal before the checker saw it, so the value is already lost.
export const run = (): i64 => {
  const big: i64 = 123456789012345678901;
  return big;
};

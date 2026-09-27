// A separator between two digits is only for the reader: each literal is the
// value its digits spell, in every radix the checker reads and in a fraction
// and an exponent (issue #263).
export const main = (): i32 => {
  const million: i32 = 1_000_000;
  const mask: i32 = 0xFF_FF;
  const big: i64 = 9_007_199_254_740_991;
  const price: f64 = 1_234.5_6;
  const tenBillion: f64 = 1e1_0;
  console.log(`${million} ${mask} ${big}`);
  console.log(`${price} ${tenBillion}`);
  return 0;
};

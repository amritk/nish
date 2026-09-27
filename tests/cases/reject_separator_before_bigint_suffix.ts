// A separator right before the BigInt suffix is trailing, in a hexadecimal
// and in a decimal literal; tsc: TS6188, not the validator's `bigint` refusal.
export const main = (): i32 => {
  const mask = 0xFF_n;
  const one = 1_n;
  return 0;
};

// An unsigned context has the same 2^53 problem: the parser rounded it first.
export const run = (): u64 => {
  const big: u64 = 123456789012345678901;
  return big;
};

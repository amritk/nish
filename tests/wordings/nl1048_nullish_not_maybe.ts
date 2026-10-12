// NL1048: `??` whose left operand is neither a `T | null` nor a `Map.get` result.
export const main = (): i32 => {
  const n: i32 = 3;
  return n ?? 0;
};

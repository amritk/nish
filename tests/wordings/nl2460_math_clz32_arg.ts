// NL2460: `Math.clz32` counts the leading zeros of a 32-bit integer, so a 64-bit one is refused.
export const main = (): i32 => {
  const x: i64 = 1;
  return Math.clz32(x);
};

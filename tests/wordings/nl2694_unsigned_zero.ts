// NL2694: an unsigned value is never below zero, so this test always answers
// the same.
export const main = (): i32 => {
  const n: u32 = toU32(7);
  if (n < 0) {
    return 1;
  }
  return 0;
};

// NL2715: with the same operand on both sides, `===` is always true; the
// other side was meant to be something else.
export const main = (): i32 => {
  const a: i32 = 1;
  const b: i32 = 2;
  if (a === a) {
    return b;
  }
  return 0;
};

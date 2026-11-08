// NL2691: a value stored into itself does nothing.
export const main = (): i32 => {
  let n: i32 = 4;
  n = n;
  return n;
};

// NL2193: The local half of the same rule, which has a message of its own.
export const main = (): i32 => {
  const xs: i32[] = [1, 2];
  const [a, b] = xs;
  return a;
};

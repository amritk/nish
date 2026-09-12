// NL2160: A second `default` clause is refused rather than being unreachable code.
export const main = (): i32 => {
  const n: i32 = 1;
  switch (n) {
    default:
      return 1;
    default:
      return 2;
  }
};

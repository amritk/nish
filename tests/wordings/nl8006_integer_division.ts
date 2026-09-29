// NL8006: an integer `/` truncates, where TypeScript keeps the fraction.
export const main = (): number => {
  const n: i32 = 7;
  return n / 2;
};

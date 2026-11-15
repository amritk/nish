// NL9001: a pattern over an array allocated on every iteration names the pattern as written.
export const main = (): number => {
  let total = 0;
  for (let i = 1; i < 4; i++) {
    const [a, b] = new Array<i32>(i + 1);
    total += a + b;
  }
  return total;
};

// The same guard ending in `process.exit` ends the path too, so `xs[i]` is
// proven in range: no `nish_panic_index` in the IR, and no NL9007 warning.
const sumAt = (xs: number[], at: number[]): number => {
  let total = 0;
  for (let k = 0; k < at.length; k = k + 1) {
    const i = at[k];
    if (i < 0 || i >= xs.length) {
      process.exit(3);
    }
    total = total + xs[i];
  }
  return total;
};

export const test = (): number => sumAt([10, 20, 30], [2, 0, 1, 2]);

// A guard whose failing branch ends in `panic` ends the path the way a
// `return` does, so the negation of its test holds after it and `xs[i]` is
// proven in range: no `nish_panic_index` in the IR, and no NL9007 warning.
const sumAt = (xs: number[], at: number[]): number => {
  let total = 0;
  for (let k = 0; k < at.length; k = k + 1) {
    const i = at[k];
    if (i < 0 || i >= xs.length) {
      panic("index out of range");
    }
    total = total + xs[i];
  }
  return total;
};

export const test = (): number => sumAt([10, 20, 30], [2, 0, 1, 2]);

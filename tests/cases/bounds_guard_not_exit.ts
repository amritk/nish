// The negative of `bounds_panic_guard`: a guard whose failing branch ends in a
// plain call falls through to the access, so nothing is proven, the check on
// `xs[i]` stays and NL9007 still names it.
const sumAt = (xs: number[], at: number[]): number => {
  let total = 0;
  for (let k = 0; k < at.length; k = k + 1) {
    const i = at[k];
    if (i < 0 || i >= xs.length) {
      console.log("index out of range");
    }
    total = total + xs[i];
  }
  return total;
};

export const test = (): number => sumAt([10, 20, 30], [2, 0, 1, 2]);

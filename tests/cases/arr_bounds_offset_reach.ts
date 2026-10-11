// A guard reaches only as far as it says: `i + 1 < xs.length` proves `xs[i + 1]`
// but not `xs[i + 2]`, which keeps its check and panics on the last pass with
// `index out of range: 3 >= 3`.
const tooFar = (xs: i32[]): i32 => {
  let s = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    s = s + xs[i + 1] + xs[i + 2];
  }
  return s;
};

export const main = (): number => {
  console.log(`${tooFar([1, 2, 3])}`);
  return 0;
};

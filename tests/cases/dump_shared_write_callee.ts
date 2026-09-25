// A function with no store of its own inherits the shared write of a callee,
// which is named by symbol.
const fill = (xs: number[], v: number): void => {
  for (let i = 0; i < xs.length; i++) {
    xs[i] = v;
  }
};

const reset = (xs: number[]): void => {
  fill(xs, 0);
};

const log = (n: number): void => {
  console.log(`${n}`);
};

export const run = (): number => {
  const xs: number[] = [1, 2, 3];
  reset(xs);
  log(xs[0]);
  return xs[0];
};

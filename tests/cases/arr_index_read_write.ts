// `set` writes through its parameter, so `a` is not `readonly`; `main` passes
// `xs` to it, so the write is inherited through the fixpoint too.
const set = (a: number[], i: number, v: number): void => {
  a[i] = v;
};

const get = (a: number[], i: number): number => {
  return a[i];
};

export const main = (): number => {
  const xs = [1, 2, 3];
  set(xs, 1, 42);
  xs[0] += 5;
  xs[2] *= 10;
  console.log(get(xs, 0));
  console.log(xs[1]);
  console.log(xs[2]);
  return 0;
};

// The guard bounds the sum from above only: with no `i >= 0`, `i + 1` may be
// negative, so `xs[i + 1]` keeps its check and `pick(xs, -5)` panics. The
// runtime prints the index as the unsigned compare saw it, so -4 reads
// `index out of range: 18446744073709551612 >= 3`.
const pick = (xs: i32[], i: i32): i32 => {
  if (i + 1 < xs.length) {
    return xs[i + 1];
  }
  return -1;
};

export const main = (): number => {
  const xs = [1, 2, 3];
  console.log(`${pick(xs, 0)}`);
  console.log(`${pick(xs, -5)}`);
  return 0;
};

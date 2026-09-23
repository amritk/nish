// The local form of the `&&` flaw, which predates property paths:
// `i < xs.length && drain(xs) > 0` proved `xs[i]` against the length before
// the pop. Run by tests/run.js: exit 1 with "index out of range: 2 >= 2".
//
// `drain` pops and answers the length, as in `arr_bounds_shrink_panic`,
// because `tsc` types `pop` as `T | undefined`.
const drain = (ys: i32[]): i32 => {
  ys.pop();
  return ys.length;
};

const read = (xs: i32[], i: i32): i32 => {
  if (i >= 0 && i < xs.length && drain(xs) > 0) {
    return xs[i];
  }
  return -1;
};

export const main = (): number => {
  console.log(`${read([1, 2, 3], 2)}`);
  return 0;
};

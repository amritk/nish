// Reassigning the index or the array forgets what a check on them proved: an
// increment keeps `k >= 0` and loses `k < xs.length`, a plain assignment
// loses both, and rebinding `ys` forgets every fact keyed on it. A value that
// rewrites the index of its own store is checked against the old index, so
// the new one is not proven by it. Every repeat keeps its check.
const stepped = (xs: i32[], i: i32): i32 => {
  let k = i;
  const a = xs[k];
  k = k + 1;
  return a + xs[k];
};

const replaced = (xs: i32[], i: i32, j: i32): i32 => {
  let k = i;
  const a = xs[k];
  k = j;
  return a + xs[k];
};

const rebound = (xs: i32[], zs: i32[], i: i32): i32 => {
  let ys = xs;
  const a = ys[i];
  ys = zs;
  return a + ys[i];
};

const rewritten = (xs: i32[], i: i32, j: i32): i32 => {
  let k = i;
  xs[k] = (k = j);
  return xs[k];
};

export const test = (): number =>
  stepped([1, 2, 3], 0) + replaced([1, 2, 3], 0, 2) + rebound([1, 2], [3, 4, 5], 1) + rewritten([1, 2, 3], 0, 1);

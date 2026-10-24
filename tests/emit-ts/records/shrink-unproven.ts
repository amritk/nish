// An i32 compound store at an index no caller proves, whose right side
// shrinks the array: the read is checked, and the store checks the index
// again after the right side ran, so it panics as native does.
const shrink = (xs: i32[]): i32 => {
  xs.pop();
  return 1;
};

const bump = (xs: i32[], k: i32): void => {
  xs[k] += shrink(xs);
};

export const main = (): i32 => {
  const ys: i32[] = [4, 5];
  const ks: i32[] = [1];
  bump(ys, ks[0]);
  console.log("unreachable");
  return 0;
};

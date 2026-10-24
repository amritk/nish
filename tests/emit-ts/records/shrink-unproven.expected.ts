// An i32 compound store at an index no caller proves, whose right side
// shrinks the array: the read is checked, and the store checks the index
// again after the right side ran, so it panics as native does.
import { pop, idx, checkedAdd, setIdx } from "nish/runtime"
import type { i32 } from "nish/runtime"
const shrink = (xs: i32[]): i32 => {
  pop(xs);
  return 1;
};

const bump = (xs: i32[], k: i32): void => {
  setIdx(xs, k, checkedAdd(idx(xs, k), shrink(xs)));
};

export const main = (): i32 => {
  const ys: i32[] = [4, 5];
  const ks: i32[] = [1];
  bump(ys, ks[0]);
  console.log("unreachable");
  return 0;
};

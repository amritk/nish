// A compound store whose right side shrinks the array: the index is proven
// for the read, but the store checks it again after the right side ran, so
// it panics rather than writing past the end, as native does.
import { pop, checkedAdd, setIdx } from "nish/runtime"
import type { i32 } from "nish/runtime"
const shrink = (xs: i32[]): i32 => {
  pop(xs);
  return 1;
};

export const main = (): i32 => {
  const ys: i32[] = [4, 5];
  if (ys.length > 1) {
    setIdx(ys, 1, checkedAdd(ys[1], shrink(ys)));
  }
  console.log("unreachable");
  return 0;
};

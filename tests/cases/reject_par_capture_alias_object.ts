// A fresh object of the body's own that holds the capture is a path to it: a
// store through the field is a store into the captured array.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

class Holder {
  cells: i32[];
  constructor(cells: i32[]) {
    this.cells = cells;
  }
}

export const main = (): i32 => {
  const t: i32[] = [1, 2];
  const ys = parallelMap([1, 2], (x): i32 => {
    const h = new Holder(t);
    h.cells[0] = x;
    return x;
  });
  return ys[0];
};

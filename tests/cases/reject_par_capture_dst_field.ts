// A captured object whose field could be `dst` is refused by its type.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

class Holder {
  cells: i32[];
  constructor(cells: i32[]) {
    this.cells = cells;
  }
}

export const main = (): i32 => {
  const dst: i32[] = [0, 0];
  const h = new Holder(dst);
  parallelMapInto([1, 2], dst, (x) => h.cells[0] + x);
  return dst[0];
};

// #612: a fresh destination passed to a helper before the call may have
// been kept by it — here into the holder the body reads.
import { parallelMap, parallelMapInto } from "nish/threads";

class Holder {
  arr: i32[];

  constructor(arr: i32[]) {
    this.arr = arr;
  }
}

const keep = (h: Holder, xs: i32[]): void => {
  h.arr = xs;
};

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  const h = new Holder(weights);
  keep(h, d);
  parallelMapInto(src, d, (x) => h.arr[x % 4] + 1);
  return d[0];
};

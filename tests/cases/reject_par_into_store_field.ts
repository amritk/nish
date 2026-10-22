// #612: a fresh destination stored into a captured object before the call
// is no longer apart from it: the body reads `d` through `p.arr`.
import { parallelMap, parallelMapInto } from "nish/threads";

class Holder {
  arr: i32[];

  constructor(arr: i32[]) {
    this.arr = arr;
  }
}

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  const p = new Holder(weights);
  p.arr = d;
  parallelMapInto(src, d, (x) => p.arr[x % 4] + weights[0]);
  return d[0];
};

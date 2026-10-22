// #612: a holder built over the fresh destination reaches it.
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
  const h = new Holder(d);
  parallelMapInto(src, d, (x) => h.arr[x % 4] + weights[0]);
  return d[0];
};

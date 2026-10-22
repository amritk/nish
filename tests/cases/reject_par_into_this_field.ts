// #612 (b14): a fresh destination stored into a field of `this` before the
// call is what a captured `self` reads through that field.
import { parallelMap, parallelMapInto } from "nish/threads";

class Table {
  tab: i32[];

  constructor() {
    this.tab = [7, 8, 9];
  }

  fill(src: i32[]): i32 {
    const weights = parallelMap(src, (x) => x * 2);
    const d = new Array<i32>(src.length);
    this.tab = d;
    const self = this;
    parallelMapInto(src, d, (x) => self.tab[x % 3] + weights[0]);
    return d[0];
  }
}

export const main = (): i32 => {
  return new Table().fill([1, 2, 3]);
};

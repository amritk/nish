// #612: a fresh `const` destination beside a captured object that holds an
// array of the destination's type — a config literal, and a `const` bound to
// `this` in a method of a class with an `i32[]` field. Neither can reach
// `d`, which no store, call or literal was handed before the call.
import { parallelMapInto } from "nish/threads";

interface Config {
  scale: i32;
  lut: i32[];
}

class Table {
  tab: i32[];
  k: i32;

  constructor() {
    this.tab = [7, 8, 9];
    this.k = 4;
  }

  lookUp(src: i32[]): i32 {
    const self = this;
    const d = new Array<i32>(src.length);
    parallelMapInto(src, d, (x) => self.tab[x % 3]);
    const e = new Array<i32>(src.length);
    parallelMapInto(src, e, (x) => x * self.k);
    return d[1] + e[2];
  }
}

export const main = (): i32 => {
  const n: i32 = 6;
  const src: i32[] = [1, 2, 3, 4, 5, 6];
  const cfg: Config = { scale: 3, lut: [1, 2, 3, 4] };
  const d = new Array<i32>(n);
  parallelMapInto(src, d, (x) => cfg.scale * cfg.lut[x % 4]);
  console.log(`${d[0]} ${d[3]} ${d[5]}`);
  console.log(`${new Table().lookUp(src)}`);
  return 0;
};

import { parallelMap } from "nish/threads";
class S {
  k: i32 = 4;
  ys: i32[];
  constructor(xs: i32[]) {
    this.ys = [];
    const self = this;
    this.ys = parallelMap(xs, (x) => x * self.k);
  }
}
export const main = (): i32 => { console.log(`${new S([1, 2, 3]).ys[2]}`); return 0; };

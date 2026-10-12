import { parallelMap } from "nish/threads";
class S {
  m: Map<i32, i32>;
  constructor() { this.m = new Map<i32, i32>(); }
  run(xs: i32[]): i32 {
    this.m.set(1, 10);
    const self = this;
    const ys = parallelMap(xs, (x) => x + self.m.size);
    return ys[1];
  }
}
export const main = (): i32 => { console.log(`${new S().run([1, 2, 3])}`); return 0; };

import { parallelReduce, parallelFrom } from "nish/threads";
class S {
  out: i32[];
  constructor() { this.out = [1, 2, 3]; }
  run(): i32 {
    const self = this;
    const ys = parallelFrom(3000000, (i) => self.out[i % 3]);
    let s: i32 = 0;
    for (const v of ys) s = (s + v) % 1000003;
    return s + parallelReduce(this.out, (a, b) => a + b, 0);
  }
}
export const main = (): i32 => { console.log(`${new S().run()}`); return 0; };

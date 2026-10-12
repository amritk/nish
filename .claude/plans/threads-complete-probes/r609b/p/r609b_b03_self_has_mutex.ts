import { Mutex, parallelMap } from "nish/threads";
class Counter { n: i32 = 0; }
class S {
  m: Mutex<Counter>;
  constructor() { this.m = new Mutex<Counter>(new Counter()); }
  k: i32 = 3;
  run(xs: i32[]): i32 {
    const self = this;
    const ys = parallelMap(xs, (x) => x * self.k);
    return ys[1];
  }
}
export const main = (): i32 => { console.log(`${new S().run([1, 2, 3])}`); return 0; };

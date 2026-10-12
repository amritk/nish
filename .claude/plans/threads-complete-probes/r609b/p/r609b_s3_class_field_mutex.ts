import { Mutex, parallelMap } from "nish/threads";
class Counter { n: i32 = 0; }
class Locked {
  m: Mutex<Counter>;
  constructor() { this.m = new Mutex<Counter>(new Counter()); }
  area(x: i32): i32 { return x * 2; }
}
class Holder {
  shape: Locked;
  constructor(s: Locked) { this.shape = s; }
  run(xs: i32[]): i32 {
    const self = this;
    const ys = parallelMap(xs, (x) => self.shape.area(x));
    return ys[2];
  }
}
export const main = (): i32 => { console.log(`${new Holder(new Locked()).run([1, 2, 3])}`); return 0; };

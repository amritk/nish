import { Mutex, parallelMap } from "nish/threads";
class Counter {
  n: i32 = 0;
}
class Hold {
  m: Mutex<Counter>;
  k: i32 = 2;
  constructor(m: Mutex<Counter>) {
    this.m = m;
  }
}
export const main = (): i32 => {
  const h = new Hold(new Mutex<Counter>(new Counter()));
  const ys = parallelMap([1, 2], (x) => x * h.k);
  console.log(`${ys[1]}`);
  return 0;
};

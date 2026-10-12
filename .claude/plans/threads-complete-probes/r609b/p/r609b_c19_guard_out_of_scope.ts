import { Mutex, parallelMap } from "nish/threads";
class Counter { n: i32 = 5; }
export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  let k: i32 = 0;
  {
    using g = m.lock();
    k = g.value.n;
  }
  const kk = k;
  const ys = parallelMap([1, 2, 3], (x) => x * kk);
  console.log(`${ys[2]}`);
  return 0;
};

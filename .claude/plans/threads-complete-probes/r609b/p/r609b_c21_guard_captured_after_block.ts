import { Mutex, parallelMap } from "nish/threads";
class Counter { n: i32 = 5; }
export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const ys = parallelMap([1, 2, 3], (x) => x * 2);
  {
    using g = m.lock();
    const v = g.value.n;
    const zs = parallelMap(ys, (x) => x * v);
    console.log(`${zs[2]}`);
  }
  return 0;
};

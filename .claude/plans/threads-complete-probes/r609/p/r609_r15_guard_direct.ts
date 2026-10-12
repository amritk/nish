import { Mutex, parallelMap } from "nish/threads";
class Counter {
  n: i32 = 0;
}
export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  using g = m.lock();
  const ys = parallelMap([1, 2], (x) => x + g.value.n);
  console.log(`${ys[1]}`);
  return 0;
};

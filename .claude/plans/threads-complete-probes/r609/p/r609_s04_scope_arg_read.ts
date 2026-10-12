import { Mutex, parallelFrom, scope } from "nish/threads";
class Counter {
  n: i32 = 0;
}
const bump = (m: Mutex<Counter>): i32 => {
  using g = m.lock();
  g.value.n = g.value.n + 5;
  return g.value.n;
};
export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(bump, m, out, 0);
    const ys = parallelFrom(3, (i) => i);
    console.log(`${ys[2]}`);
  }
  console.log(`${out[0]}`);
  return 0;
};

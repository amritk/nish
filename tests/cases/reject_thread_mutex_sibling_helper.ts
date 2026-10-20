// A lock taken in a helper: `t`'s task calls `step`, which locks `m`, and the
// rule follows the calls a task makes.
import { Mutex, scope } from "nish/threads";
class C {
  n: i32 = 0;
}
const setOne = (m: Mutex<C>): i32 => {
  using g = m.lock();
  g.value.n = g.value.n * 10 + 1;
  return 0;
};
const step = (m: Mutex<C>): i32 => {
  using g = m.lock();
  g.value.n = g.value.n * 10 + 2;
  return g.value.n;
};
const read = (m: Mutex<C>): i32 => step(m);
export const main = (): i32 => {
  const m = new Mutex<C>(new C());
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(setOne, m, out, 0);
    t.spawn(read, m, seen, 0);
  }
  console.log(`${seen[0]}`);
  return 0;
};

// A `Mutex` captured by an arrow task of the other scope: the arrow locks `m`,
// which `s`'s task also locks.
import { Mutex, scope } from "nish/threads";
class C {
  n: i32 = 0;
}
const setOne = (m: Mutex<C>): i32 => {
  using g = m.lock();
  g.value.n = g.value.n * 10 + 1;
  return 0;
};
export const main = (): i32 => {
  const m = new Mutex<C>(new C());
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(setOne, m, out, 0);
    t.spawn(
      (k: i32): i32 => {
        using g = m.lock();
        g.value.n = g.value.n * 10 + 2;
        return g.value.n + k;
      },
      0,
      seen,
      0,
    );
  }
  console.log(`${seen[0]}`);
  return 0;
};

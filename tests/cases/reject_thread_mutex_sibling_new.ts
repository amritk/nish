// A lock taken in a constructor reached by `new`: `t`'s task builds an `L`,
// whose constructor locks `m`, so the task takes the lock `s`'s task takes.
import { Mutex, scope } from "nish/threads";
class C {
  n: i32 = 0;
}
const setOne = (m: Mutex<C>): i32 => {
  using g = m.lock();
  g.value.n = g.value.n * 10 + 1;
  return 0;
};
class L {
  v: i32;
  constructor(m: Mutex<C>) {
    using g = m.lock();
    g.value.n = g.value.n * 10 + 2;
    this.v = g.value.n;
  }
}
const make = (m: Mutex<C>): i32 => new L(m).v;
export const main = (): i32 => {
  const m = new Mutex<C>(new C());
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(setOne, m, out, 0);
    t.spawn(make, m, seen, 0);
  }
  console.log(`${seen[0]}`);
  return 0;
};

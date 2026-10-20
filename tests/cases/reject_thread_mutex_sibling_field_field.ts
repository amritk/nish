// A `Mutex` two fields deep: `t`'s task locks `m` as `o.i.m`, read as any
// `Mutex<C>`, so the pair is refused.
import { Mutex, scope } from "nish/threads";
class C {
  n: i32 = 0;
}
const setOne = (m: Mutex<C>): i32 => {
  using g = m.lock();
  g.value.n = g.value.n * 10 + 1;
  return 0;
};
class I {
  m: Mutex<C>;
  constructor(m: Mutex<C>) {
    this.m = m;
  }
}
class O {
  i: I;
  constructor(i: I) {
    this.i = i;
  }
}
const read = (o: O): i32 => {
  using g = o.i.m.lock();
  g.value.n = g.value.n * 10 + 2;
  return g.value.n;
};
export const main = (): i32 => {
  const m = new Mutex<C>(new C());
  const o = new O(new I(m));
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(setOne, m, out, 0);
    t.spawn(read, o, seen, 0);
  }
  console.log(`${seen[0]}`);
  return 0;
};

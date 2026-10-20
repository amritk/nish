// A `Mutex` handed out of a constructor through `this`: `H` pushes itself
// into `reg`, so `t`'s task locks `h.m` as `reg[i].m`.
import { Mutex, scope } from "nish/threads";
class C {
  n: i32 = 0;
}
const setOne = (m: Mutex<C>): i32 => {
  using g = m.lock();
  g.value.n = g.value.n * 10 + 1;
  return 0;
};
class H {
  m: Mutex<C>;
  constructor(m: Mutex<C>, reg: H[]) {
    this.m = m;
    reg.push(this);
  }
}
const read = (reg: H[]): i32 => {
  using g = reg[0].m.lock();
  g.value.n = g.value.n * 10 + 2;
  return g.value.n;
};
export const main = (): i32 => {
  const reg: H[] = [];
  const h = new H(new Mutex<C>(new C()), reg);
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(setOne, h.m, out, 0);
    t.spawn(read, reg, seen, 0);
  }
  console.log(`${seen[0]}`);
  return 0;
};

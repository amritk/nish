// One `Mutex` reached as a binding by one sibling's task and as a field by the
// other's: the field is read as any `Mutex<C>`, so the pair is refused.
import { Mutex, scope } from "nish/threads";
class C {
  n: i32 = 0;
}
class Holder {
  lock: Mutex<C>;
  constructor(lock: Mutex<C>) {
    this.lock = lock;
  }
}
const setOne = (m: Mutex<C>): i32 => {
  using g = m.lock();
  g.value.n = 1;
  return 0;
};
const read = (h: Holder): i32 => {
  using g = h.lock.lock();
  return g.value.n;
};
export const main = (): i32 => {
  const m = new Mutex<C>(new C());
  const h = new Holder(m);
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(setOne, m, out, 0);
    t.spawn(read, h, seen, 0);
  }
  console.log(`${seen[0]}`);
  return 0;
};

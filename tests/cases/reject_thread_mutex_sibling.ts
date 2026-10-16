// R7 across the two scopes of one `using`, with a lock: natively `t`'s task
// reads the field before `s`'s sets it, under Node after.
import { Mutex, scope } from "nish/threads";
class C {
  n: i32 = 0;
}
const setOne = (m: Mutex<C>): i32 => {
  using g = m.lock();
  g.value.n = 1;
  return 0;
};
const read = (m: Mutex<C>): i32 => {
  using g = m.lock();
  return g.value.n;
};
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

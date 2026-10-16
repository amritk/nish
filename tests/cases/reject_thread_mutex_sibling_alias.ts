// Two bindings, one `Mutex`: `n` is `m` under another name, so the sibling
// rule, which tells locks apart only by the `const` each was made in, reads
// `n` as any `Mutex<C>` and refuses the pair.
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
  const n = m;
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(setOne, m, out, 0);
    t.spawn(read, n, seen, 0);
  }
  console.log(`${seen[0]}`);
  return 0;
};

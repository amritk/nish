// Three declarators: the first and the last scope lock the same `Mutex`, with
// a scope that shares nothing between them, and the rule compares every pair.
import { Mutex, scope } from "nish/threads";
class C {
  n: i32 = 0;
}
const setOne = (m: Mutex<C>): i32 => {
  using g = m.lock();
  g.value.n = g.value.n * 10 + 1;
  return 0;
};
const id = (x: i32): i32 => x;
const read = (m: Mutex<C>): i32 => {
  using g = m.lock();
  g.value.n = g.value.n * 10 + 2;
  return g.value.n;
};
export const main = (): i32 => {
  const m = new Mutex<C>(new C());
  const out: i32[] = [0];
  const mid: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), u = scope(), t = scope();
    s.spawn(setOne, m, out, 0);
    u.spawn(id, 3, mid, 0);
    t.spawn(read, m, seen, 0);
  }
  console.log(`${seen[0]} ${mid[0]}`);
  return 0;
};

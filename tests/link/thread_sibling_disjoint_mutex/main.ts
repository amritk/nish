// Round 2 of the atomics review: two scopes of one `using` whose tasks lock
// two `Mutex<C>`s of the same type, each made by `new` in a `const` of its
// own, share no lock, so the sibling rule accepts them. Each task's adds land
// on its own lock natively, at any pool size, and under Node.
import { Mutex, scope } from "nish/threads";
class C {
  n: i32 = 0;
}
const bump = (m: Mutex<C>): i32 => {
  for (let i: i32 = 0; i < 1000; i++) {
    using g = m.lock();
    g.value.n = g.value.n + 1;
  }
  using g = m.lock();
  return g.value.n;
};
export const main = (): i32 => {
  const a = new Mutex<C>(new C());
  const b = new Mutex<C>(new C());
  const fromA: i32[] = [0, 0];
  const fromB: i32[] = [0, 0];
  {
    using s = scope(), t = scope();
    s.spawn(bump, a, fromA, 0);
    s.spawn(bump, a, fromA, 1);
    t.spawn(bump, b, fromB, 0);
    t.spawn(() => {
      using g = b.lock();
      g.value.n = g.value.n + 5;
    });
  }
  using ga = a.lock();
  const na = ga.value.n;
  console.log(`${na} ${Math.max(fromA[0], fromA[1])}`);
  console.log(`${fromB[0] === 1000 || fromB[0] === 1005}`);
  return 0;
};

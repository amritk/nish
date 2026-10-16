// Round 2 of the atomics review: sibling scopes whose tasks update atomics
// each made by `new` in a `const` of its own share no atomic, so the sibling
// rule accepts two `AtomicI32`s, two `AtomicI64`s, and an `AtomicI32` beside an
// `AtomicI64`, and every add lands natively at any pool size and under Node.
import { AtomicI32, AtomicI64, scope } from "nish/threads";
const add32 = (a: AtomicI32): i32 => {
  for (let i: i32 = 0; i < 1000; i++) {
    a.add(1);
  }
  return 0;
};
const step: i64 = 3;
const add64 = (a: AtomicI64): i32 => {
  for (let i: i32 = 0; i < 1000; i++) {
    a.add(step);
  }
  return 0;
};
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const b = new AtomicI32(10);
  const c = new AtomicI64(0);
  const d = new AtomicI64(1099511627776);
  const o1: i32[] = [0, 0];
  const o2: i32[] = [0, 0];
  const o3: i32[] = [0];
  const o4: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(add32, a, o1, 0);
    s.spawn(add32, a, o1, 1);
    t.spawn(add32, b, o2, 0);
    t.spawn(add32, b, o2, 1);
  }
  {
    using s = scope(), t = scope();
    s.spawn(add64, c, o1, 0);
    t.spawn(add64, d, o2, 0);
  }
  {
    using s = scope(), t = scope(), u = scope();
    s.spawn(add32, a, o3, 0);
    t.spawn(add64, c, o4, 0);
    u.spawn(() => {
      b.add(7);
    });
  }
  console.log(`${a.load()} ${b.load()}`);
  console.log(`${c.load()} ${d.load()}`);
  return 0;
};

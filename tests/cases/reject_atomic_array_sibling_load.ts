// R7 across the two scopes of one `using`: natively `t` joins first, so its
// load ran before any of `s`'s adds, and under Node after all of them.
import { AtomicI64Array, scope } from "nish/threads";
const bump = (a: AtomicI64Array): i32 => {
  const one: i64 = 1;
  for (let i: i32 = 0; i < 100000; i++) {
    a.add(i % 4, one);
  }
  return 0;
};
const peek = (a: AtomicI64Array): i64 => a.load(0);
export const main = (): i32 => {
  const a = new AtomicI64Array(4);
  const out: i32[] = [0];
  const seen: i64[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(bump, a, out, 0);
    t.spawn(peek, a, seen, 0);
  }
  console.log(`${seen[0]} ${a.load(0)}`);
  return 0;
};

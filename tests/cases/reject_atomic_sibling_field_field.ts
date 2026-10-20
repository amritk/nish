// An atomic two fields deep: `t`'s task reaches `a` as `o.i.a`, and the rule
// walks the fields of what a task is handed, so the pair is refused.
import { AtomicI32, scope } from "nish/threads";
class I {
  a: AtomicI32;
  constructor(a: AtomicI32) {
    this.a = a;
  }
}
class O {
  i: I;
  constructor(i: I) {
    this.i = i;
  }
}
const bump = (a: AtomicI32): i32 => a.add(1);
const peek = (o: O): i32 => o.i.a.load();
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const o = new O(new I(a));
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(bump, a, out, 0);
    t.spawn(peek, o, seen, 0);
  }
  console.log(`${seen[0]} ${a.load()}`);
  return 0;
};

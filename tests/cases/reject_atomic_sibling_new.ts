// An atomic reached by `new` inside an arrow task: `Peek`'s constructor loads
// `h.a`, and a constructor is a call, so the rule follows it.
import { AtomicI32, scope } from "nish/threads";
class H {
  a: AtomicI32;
  constructor(a: AtomicI32) {
    this.a = a;
  }
}
class Peek {
  v: i32;
  constructor(h: H) {
    this.v = h.a.load();
  }
}
const bump = (a: AtomicI32): i32 => a.add(1);
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const h = new H(a);
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(bump, a, out, 0);
    t.spawn((n: i32): i32 => new Peek(h).v + n, 0, seen, 0);
  }
  console.log(`${seen[0]} ${a.load()}`);
  return 0;
};

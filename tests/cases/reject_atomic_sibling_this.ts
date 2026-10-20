// An atomic handed out of a constructor through `this`: `H` pushes itself into
// `reg`, so `t`'s task reaches `a` as `reg[i].a`, read as any `AtomicI32`.
import { AtomicI32, scope } from "nish/threads";
class H {
  a: AtomicI32;
  constructor(a: AtomicI32, reg: H[]) {
    this.a = a;
    reg.push(this);
  }
}
const bump = (a: AtomicI32): i32 => a.add(1);
const peek = (reg: H[]): i32 => reg[0].a.load();
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const reg: H[] = [];
  const h = new H(a, reg);
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(bump, a, out, 0);
    t.spawn(peek, reg, seen, 0);
  }
  console.log(`${seen[0]} ${h.a.load()}`);
  return 0;
};

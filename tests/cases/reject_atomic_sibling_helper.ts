// R7 across the two scopes of one `using`, through a helper: `id(a)` returns
// `a`, so the rule reads the call by type and refuses the pair.
import { AtomicI32, scope } from "nish/threads";
const bump = (a: AtomicI32): i32 => a.add(1);
const peek = (a: AtomicI32): i32 => a.load();
const id = (a: AtomicI32): AtomicI32 => a;
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(bump, a, out, 0);
    t.spawn(peek, id(a), seen, 0);
  }
  console.log(`${seen[0]} ${a.load()}`);
  return 0;
};

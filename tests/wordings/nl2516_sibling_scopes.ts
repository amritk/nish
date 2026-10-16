// NL2516: two scopes of one `using` whose tasks share an atomic: natively `t`
// joins first, under Node each task runs at its spawn.
import { AtomicI32, scope } from "nish/threads";
const bump = (a: AtomicI32): i32 => a.add(1);
const peek = (a: AtomicI32): i32 => a.load();
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const out: i32[] = [0];
  const seen: i32[] = [0];
  {
    using s = scope(), t = scope();
    s.spawn(bump, a, out, 0);
    t.spawn(peek, a, seen, 0);
  }
  return seen[0];
};

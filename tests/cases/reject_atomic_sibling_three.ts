// R7 across the three scopes of one `using`: `t`'s task is judged in the
// region of `r`, the first declarator, though it is spawned before it.
import { AtomicI32, scope } from "nish/threads";
const bump = (a: AtomicI32): i32 => a.add(1);
const peek = (a: AtomicI32): i32 => a.load();
const other = (x: i32): i32 => x + 1;
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const out: i32[] = [0, 0, 0];
  {
    using r = scope(), s = scope(), t = scope();
    t.spawn(peek, a, out, 2);
    s.spawn(other, 3, out, 1);
    r.spawn(bump, a, out, 0);
  }
  console.log(`${out[2]}`);
  return 0;
};

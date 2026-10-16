// R7 is by type: an alias through `?:` is refused, whichever arm it takes.
import { AtomicI32, scope } from "nish/threads";
const bump = (a: AtomicI32): i32 => a.add(1);
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const b = new AtomicI32(0);
  const done: i32[] = [0];
  const flip: boolean = done.length > 0;
  {
    using s = scope();
    s.spawn(bump, a, done, 0);
    const c = flip ? b : a;
    c.add(1);
  }
  return a.load();
};

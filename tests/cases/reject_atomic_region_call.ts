// R7 walks what a call reaches: `peek` loads the atomic the task updates.
import { AtomicI32, scope } from "nish/threads";
const bump = (a: AtomicI32): i32 => a.add(1);
const peek = (a: AtomicI32): i32 => a.load();
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const done: i32[] = [0];
  let seen: i32 = 0;
  {
    using s = scope();
    s.spawn(bump, a, done, 0);
    seen = peek(a);
  }
  return seen;
};

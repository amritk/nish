// NL2513: after a scope's first `spawn` the parent does not touch an atomic its
// tasks share. Natively the task has not run here and under Node it has, so
// `seen` would be 0 compiled and 1 under Node.
import { AtomicI32, scope } from "nish/threads";

const bump = (a: AtomicI32): i32 => a.add(1);

export const main = (): i32 => {
  const a = new AtomicI32(0);
  const done: i32[] = [0];
  let seen: i32 = 0;
  {
    using s = scope();
    s.spawn(bump, a, done, 0);
    seen = a.load();
  }
  return seen;
};

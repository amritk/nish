// R7: the parent does not touch an atomic a task can reach inside the scope's
// block. Natively the task runs at the join; under Node, where it is spawned.
import { AtomicI32, scope } from "nish/threads";
const bump = (a: AtomicI32): i32 => a.add(1);
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(bump, a, done, 0);
    a.store(5);
  }
  return a.load();
};

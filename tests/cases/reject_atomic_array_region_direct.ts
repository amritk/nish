// R7: the parent does not touch an atomic array a task can reach inside the
// scope's block. Natively the task runs at the join; under Node, where it is
// spawned.
import { AtomicI32Array, scope } from "nish/threads";
const bump = (a: AtomicI32Array): i32 => a.add(0, 1);
export const main = (): i32 => {
  const a = new AtomicI32Array(2);
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(bump, a, done, 0);
    a.store(0, 5);
  }
  return a.load(0);
};

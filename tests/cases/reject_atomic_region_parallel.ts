// R7: a parallel call in the scope's block runs bodies that update the atomic.
import { AtomicI32, parallelMap, scope } from "nish/threads";
const bump = (a: AtomicI32): i32 => a.add(1);
export const main = (): i32 => {
  const a = new AtomicI32(0);
  const done: i32[] = [0];
  const xs: i32[] = [1, 2, 3];
  {
    using s = scope();
    s.spawn(bump, a, done, 0);
    const ys = parallelMap(xs, (x: i32): i32 => a.add(x));
    done[0] = ys.length;
  }
  return a.load();
};

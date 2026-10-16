// R7 follows the task's argument into its elements: `arg[i]`.
import { AtomicI32, scope } from "nish/threads";
const bump = (hist: AtomicI32[]): i32 => hist[0].add(1);
export const main = (): i32 => {
  const hist: AtomicI32[] = [new AtomicI32(0), new AtomicI32(0)];
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(bump, hist, done, 0);
    hist[1].max(9);
  }
  return hist[0].load();
};

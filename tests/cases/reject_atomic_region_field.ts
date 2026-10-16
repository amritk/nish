// R7 follows the task's argument into its fields: `arg.hits`.
import { AtomicI32, scope } from "nish/threads";
class Pair {
  hits: AtomicI32;
  misses: AtomicI32;
  constructor(hits: AtomicI32, misses: AtomicI32) {
    this.hits = hits;
    this.misses = misses;
  }
}
const bump = (p: Pair): i32 => p.hits.add(1);
export const main = (): i32 => {
  const p = new Pair(new AtomicI32(0), new AtomicI32(0));
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(bump, p, done, 0);
    p.misses.sub(1);
  }
  return p.hits.load();
};

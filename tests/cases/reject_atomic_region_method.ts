// R7 sees through a method that forwards to the atomic: `Stats.hit`.
import { AtomicI32, scope } from "nish/threads";
class Stats {
  hits: AtomicI32;
  constructor() {
    this.hits = new AtomicI32(0);
  }
  hit(): i32 {
    return this.hits.add(1);
  }
}
const bump = (st: Stats): i32 => st.hit();
export const main = (): i32 => {
  const st = new Stats();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(bump, st, done, 0);
    st.hit();
  }
  return st.hits.load();
};

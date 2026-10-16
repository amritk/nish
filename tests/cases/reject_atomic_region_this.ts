// R7 follows `this` out of a constructor: `h.w = this` hands the parent the
// `Worker` whose atomic the task updates.
import { AtomicI32, scope } from "nish/threads";
class Holder {
  w: Worker | null = null;
}
class Worker {
  a: AtomicI32;
  constructor(h: Holder) {
    this.a = new AtomicI32(0);
    h.w = this;
  }
}
const bump = (w: Worker): i32 => w.a.add(1);
export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(bump, new Worker(h), done, 0);
    const w = h.w;
    if (w !== null) {
      w.a.add(1);
    }
  }
  return 0;
};

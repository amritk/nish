// A constructor that hands `this` to the object a task captured stores into
// that object: `new Leak(h)` before the join is a write the task may read.
import { Mutex, scope } from "nish/threads";

class Tally {
  total: i32 = 0;
}

const addTo = (tally: Mutex<Tally>, xs: i32[]): void => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  using g = tally.lock();
  g.value.total = g.value.total + t;
};

class Holder {
  held: Leak | null = null;
}

class Leak {
  v: i32 = 0;

  constructor(h: Holder) {
    h.held = this;
  }
}

const readInto = (tally: Mutex<Tally>, h: Holder): void => {
  using g = tally.lock();
  g.value.total = h.held === null ? 0 : 1;
};

export const main = (): i32 => {
  const h = new Holder();
  const tally = new Mutex<Tally>(new Tally());
  {
    using s = scope();
    s.spawn(() => readInto(tally, h));
    const leak = new Leak(h);
  }
  return 0;
};

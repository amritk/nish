// A constructor is a call: `new Bump(b)` writes the object the task captured,
// before the join.
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

interface Box {
  v: i32;
}

class Bump {
  constructor(b: Box) {
    b.v = b.v + 1;
  }
}

const readInto = (tally: Mutex<Tally>, b: Box): void => {
  using g = tally.lock();
  g.value.total = b.v;
};

export const main = (): i32 => {
  const b: Box = { v: 1 };
  const tally = new Mutex<Tally>(new Tally());
  {
    using s = scope();
    s.spawn(() => readInto(tally, b));
    const bumped = new Bump(b);
  }
  return 0;
};

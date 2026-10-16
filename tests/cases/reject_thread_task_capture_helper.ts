// A helper that writes through the captured array, called before the join, is
// a write the task may read, as a store would be.
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

const zero = (xs: i32[]): void => {
  xs[0] = 0;
};

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const tally = new Mutex<Tally>(new Tally());
  {
    using s = scope();
    s.spawn(() => addTo(tally, xs));
    zero(xs);
  }
  return 0;
};

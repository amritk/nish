// R7: the parent may not lock a `Mutex` a task reaches between the statement
// that holds the first spawn and the join, and a captured lock is reached as
// an argument is.
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

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const tally = new Mutex<Tally>(new Tally());
  {
    using s = scope();
    s.spawn(() => addTo(tally, xs));
    using g = tally.lock();
  }
  return 0;
};

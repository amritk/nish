// The scope the task is spawned on is the second declarator of its `using`
// statement: its region is judged as the first one's is.
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
    using s = scope(), t = scope();
    t.spawn(() => addTo(tally, xs));
    xs[1] = 7;
  }
  return 0;
};

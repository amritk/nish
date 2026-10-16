// The task captures `ys`, a second name for `xs`: a write through `xs` before
// the join is a write the task may read, whichever name it holds.
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
  const ys = xs;
  const tally = new Mutex<Tally>(new Tally());
  {
    using s = scope();
    s.spawn(() => addTo(tally, ys));
    xs[1] = 7;
  }
  return 0;
};

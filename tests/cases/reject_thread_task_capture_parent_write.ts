// A task's arrow reads `xs` when the scope joins, as a task reads its
// argument, so the parent may not write `xs` between the spawn and the join:
// natively the task would see 9, and under Node, where it ran at the spawn, 1.
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
    xs[0] = 9;
  }
  return 0;
};

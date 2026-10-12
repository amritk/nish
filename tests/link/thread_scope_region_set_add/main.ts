// A `Set` a function makes itself, filled and trimmed between a scope's first
// `spawn` and its join: `add` and `delete` write the set and nothing the task
// reads.
import { scope } from "nish/threads";

class Holder {
  v: i32 = 1;
}

const read = (h: Holder): i32 => h.v;

const tally = (h: Holder): i32 => {
  const s = new Set<i32>();
  s.add(h.v);
  s.add(2);
  s.add(3);
  s.delete(2);
  let sum = 0;
  for (const x of s) {
    sum = sum + x;
  }
  return s.size * 10 + sum;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  let r = 0;
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    r = tally(h);
  }
  console.log(`${done[0]} ${r}`);
  return 0;
};

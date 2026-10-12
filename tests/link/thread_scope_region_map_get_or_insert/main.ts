// The same through `getOrInsert` from `nish/map`, whose first argument is the
// map it fills: a map of the function's own, so the call writes nothing a task
// reads.
import { getOrInsert } from "nish/map";
import { scope } from "nish/threads";

class Holder {
  v: i32 = 1;
}

const read = (h: Holder): i32 => h.v;

const tally = (h: Holder): i32 => {
  const m = new Map<string, i32>();
  const a = getOrInsert(m, "a", h.v);
  const b = getOrInsert(m, "a", 7);
  return a * 100 + b * 10 + m.size;
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

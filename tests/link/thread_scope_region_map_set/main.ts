// A `Map` a function makes itself, filled between a scope's first `spawn` and
// its join: `set` stores the argument's number into the map, which writes the
// map and nothing the task reads. Natively the task runs at the join and under
// Node at the spawn, and both print the same.
import { scope } from "nish/threads";

class Holder {
  v: i32 = 1;
}

const read = (h: Holder): i32 => h.v;

const tally = (h: Holder): i32 => {
  const m = new Map<string, i32>();
  if (!m.has("a")) {
    m.set("a", h.v);
  }
  m.set("b", 2);
  m.set("c", h.v + 2);
  m.delete("c");
  return m.size * 10 + (m.get("a") ?? 0);
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

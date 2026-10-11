// A parallel body takes no lock through a callee either: `tally` calls `add`,
// which takes one, and `parallelMapInto` runs `tally` on many threads at once.
import { Mutex, parallelMapInto } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Item {
  total: Mutex<Counter>;
  x: i32;

  constructor(total: Mutex<Counter>, x: i32) {
    this.total = total;
    this.x = x;
  }
}

const add = (m: Mutex<Counter>, k: i32): void => {
  using g = m.lock();
  g.value.n = g.value.n + k;
};

const tally = (it: Item): i32 => {
  add(it.total, it.x);
  return it.x;
};

export const main = (): i32 => {
  const total = new Mutex<Counter>(new Counter());
  const src: Item[] = [new Item(total, 1), new Item(total, 2)];
  const dst: i32[] = [0, 0];
  parallelMapInto(src, dst, tally);
  return dst[1];
};

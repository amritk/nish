// NL2474: A lock is taken by a scope's task or by the thread that opened the scope,
// never by the body of `parallelMapInto`, which runs on many threads at once.
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

const tally = (it: Item): i32 => {
  using g = it.total.lock();
  g.value.n = g.value.n + it.x;
  return it.x;
};

export const main = (): i32 => {
  const total = new Mutex<Counter>(new Counter());
  const src: Item[] = [new Item(total, 1), new Item(total, 2)];
  const dst: i32[] = [0, 0];
  parallelMapInto(src, dst, tally);
  return dst[1];
};

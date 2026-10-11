// A parallel body takes no lock through a constructor either: `tally` makes a
// `Peek`, whose constructor locks, on many threads at once.
import { Mutex, parallelMapInto } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Peek {
  seen: i32;

  constructor(m: Mutex<Counter>) {
    using g = m.lock();
    this.seen = g.value.n;
  }
}

const tally = (m: Mutex<Counter>): i32 => new Peek(m).seen;

export const main = (): i32 => {
  const total = new Mutex<Counter>(new Counter());
  const src: Mutex<Counter>[] = [total];
  const dst: i32[] = [0];
  parallelMapInto(src, dst, tally);
  return dst[0];
};

// R8: a `Map` field holding `Mutex`es reaches them through its entries, which
// is deeper than a field of the argument's class.
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Pool {
  ms: Map<string, Mutex<Counter>>;

  constructor() {
    this.ms = new Map<string, Mutex<Counter>>();
  }
}

const first = (p: Pool): i32 => 0;

export const main = (): i32 => {
  const p = new Pool();
  p.ms.set("a", new Mutex<Counter>(new Counter()));
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(first, p, done, 0);
  }
  return done[0];
};

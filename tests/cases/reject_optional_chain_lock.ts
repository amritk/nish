// R5 through a `?.` chain: `h?.add(b, g.value.n)` calls `Adder.add` only
// where `h` is not `null`, and that call takes a second lock while `g` holds
// the first, so the chain is held to the rule as the plain call is.
import { Mutex } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Adder {
  add(m: Mutex<Counter>, k: i32): i32 {
    using g = m.lock();
    g.value.n = g.value.n + k;
    return g.value.n;
  }
}

export const main = (): i32 => {
  const a = new Mutex<Counter>(new Counter());
  const b = new Mutex<Counter>(new Counter());
  const h: Adder | null = new Adder();
  {
    using g = a.lock();
    const total = h?.add(b, g.value.n) ?? 0;
    console.log(`${total}`);
  }
  return 0;
};

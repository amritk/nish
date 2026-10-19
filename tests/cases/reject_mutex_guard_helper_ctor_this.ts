// R3, a guard handed to a helper: a constructor that receives the guard and hands `this` out: the constructor is refused at the `new`, so `this` never carries the guard away.
import { Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Box {
  n: i32;

  constructor(g: MutexGuard<Counter>, out: Box[]) {
    this.n = g.value.n;
    out.push(this);
  }
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const boxes: Box[] = [];
  {
    using g = m.lock();
    new Box(g, boxes);
  }
  return 0;
};

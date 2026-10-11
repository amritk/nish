// R8: a `Mutex` reaches a task as its argument or a field of its argument's
// class, never two classes deep, where R7's question about types grows a path.
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Inner {
  m: Mutex<Counter>;

  constructor(m: Mutex<Counter>) {
    this.m = m;
  }
}

class Outer {
  i: Inner;

  constructor(i: Inner) {
    this.i = i;
  }
}

const deep = (o: Outer): i32 => {
  using g = o.i.m.lock();
  g.value.n = g.value.n + 1;
  return 0;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(deep, new Outer(new Inner(m)), done, 0);
  }
  return done[0];
};

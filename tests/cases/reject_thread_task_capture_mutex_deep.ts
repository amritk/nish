// R8: a `Mutex` reaches a task as an argument or a field of one, never deeper,
// and a captured value is an argument.
import { Mutex, scope } from "nish/threads";

class Tally {
  total: i32 = 0;
}

class Inner {
  m: Mutex<Tally>;

  constructor(m: Mutex<Tally>) {
    this.m = m;
  }
}

class Outer {
  inner: Inner;

  constructor(inner: Inner) {
    this.inner = inner;
  }
}

const bump = (o: Outer): void => {
  using g = o.inner.m.lock();
  g.value.total = g.value.total + 1;
};

export const main = (): i32 => {
  const o = new Outer(new Inner(new Mutex<Tally>(new Tally())));
  {
    using s = scope();
    s.spawn(() => bump(o));
  }
  return 0;
};

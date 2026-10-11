// #564: a constructor that hands `this` out stores it through another of its
// parameters, which is a write the region refuses: the task reading the
// holder would see the new object natively and not under Node.
import { scope } from "nish/threads";

class Holder {
  last: Register | null = null;
}

class Register {
  v: i32 = 3;

  constructor(h: Holder) {
    h.last = this;
  }
}

const peek = (h: Holder): i32 => {
  const l = h.last;
  return l === null ? 0 : l.v;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(peek, h, done, 0);
    const r = new Register(h);
  }
  return done[0];
};

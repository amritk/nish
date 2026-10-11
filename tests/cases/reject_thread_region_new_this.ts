// #564, `this` leaving a constructor. There is no rule of its own for it: a
// constructor reaches only what its parameters reach, so it can hand `this`
// out only by storing it through another parameter, and that store is a write
// the region refuses like any other. This case pins that the route through
// `this` is one: the task reading the holder would see the new object
// natively and not under Node.
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

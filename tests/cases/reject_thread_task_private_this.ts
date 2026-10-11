// `this` out of a constructor: `Reg` keeps the task's array and hands
// itself to the holder, so the array is reachable from the task's argument
// and the store into it, after, is a shared write.
import { scope } from "nish/threads";

class Holder {
  last: Reg | null = null;
}

class Reg {
  xs: i32[];

  constructor(h: Holder, xs: i32[]) {
    this.xs = xs;
    h.last = this;
  }
}

const register = (h: Holder): i32 => {
  const xs = new Array<i32>(4);
  const r = new Reg(h, xs);
  xs[0] = 1;
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(register, h, out, 0);
  }
  return out[0];
};

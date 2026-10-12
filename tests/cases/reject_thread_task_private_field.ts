// A task's own array stored into a field of its argument is reachable from
// there, so the store into it before is a store into shared memory too.
import { scope } from "nish/threads";

class Holder {
  xs: i32[];

  constructor() {
    this.xs = [];
  }
}

const keep = (h: Holder): i32 => {
  const xs = new Array<i32>(4);
  xs[0] = 1;
  h.xs = xs;
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(keep, h, out, 0);
  }
  return out[0];
};

// A task's own array pushed onto an array its argument holds is reachable
// from there, so the store into it is a store into shared memory.
import { scope } from "nish/threads";

class Holder {
  all: i32[][];

  constructor() {
    this.all = [];
  }
}

const keep = (h: Holder): i32 => {
  const xs = new Array<i32>(4);
  xs[0] = 1;
  h.all.push(xs);
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

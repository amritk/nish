// A task's own array handed to a function that keeps it is private no
// longer: `stash` stores it into the holder, so the task's store into it,
// before the call, was to memory another task can reach.
import { scope } from "nish/threads";

class Holder {
  xs: i32[];

  constructor() {
    this.xs = [];
  }
}

const stash = (h: Holder, xs: i32[]): void => {
  h.xs = xs;
};

const keep = (h: Holder): i32 => {
  const xs = new Array<i32>(4);
  xs[0] = 1;
  stash(h, xs);
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

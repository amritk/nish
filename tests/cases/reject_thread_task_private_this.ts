// `this` leaving a constructor, for a private array. There is no rule of its
// own for it: for the array to be reached through the `this` that `Reg` hands
// the holder, `Reg` has to keep the array, and an array kept by a constructor
// is shared (`reject_thread_task_private_new`). This case pins that the route
// through `this` opens no way around that, so the task's store into the
// array after the `new` is a shared write.
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

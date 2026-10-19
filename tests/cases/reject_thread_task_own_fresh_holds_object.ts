// A helper that answers its argument or a fresh object literal holding the
// caller's `ys`: the object is new, but its field's array is not, so a write
// to that field's elements is refused.
import { scope } from "nish/threads";

class Box {
  ys: i32[];

  constructor() {
    this.ys = [0];
  }
}

interface Wrap {
  xs: i32[];
}

const pick = (a: Wrap, ys: i32[], n: i32): Wrap => {
  if (n > 0) {
    return a;
  }
  return { xs: ys };
};

const task = (p: Box): i32 => {
  const own: Wrap = { xs: [0] };
  const r = pick(own, p.ys, 0);
  r.xs[0] = 1;
  return 0;
};

export const main = (): i32 => {
  const b = new Box();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(task, b, out, 0);
  }
  return out[0] + b.ys[0];
};

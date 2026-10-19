// A helper that answers its argument or a fresh holder built around the
// caller's `ys`: the holder is new, but the array in its field is not, so a
// write to that field's elements is refused.
import { scope } from "nish/threads";

class Box {
  ys: i32[];

  constructor() {
    this.ys = [0];
  }
}

class Held {
  xs: i32[];

  constructor(ys: i32[]) {
    this.xs = ys;
  }
}

const pick = (a: Held, ys: i32[], n: i32): Held => {
  if (n > 0) {
    return a;
  }
  return new Held(ys);
};

const task = (p: Box): i32 => {
  const own = new Held([0]);
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

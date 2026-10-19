// A helper stores the argument's array into the object the task made, so the
// object's field reaches the caller's array and the store through it is shared.
import { scope } from "nish/threads";

class Box {
  ys: i32[];

  constructor() {
    this.ys = [0];
  }
}

class Held {
  xs: i32[];

  constructor() {
    this.xs = [0];
  }
}

const fill = (h: Held, ys: i32[]): void => {
  h.xs = ys;
};

const task = (p: Box): i32 => {
  const h = new Held();
  fill(h, p.ys);
  h.xs[0] = 1;
  return 0;
};

export const main = (): i32 => {
  const b = new Box();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(task, b, out, 0);
  }
  return out[0];
};

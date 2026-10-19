// A field of an object the task makes, re-pointed at its argument's array:
// the store through the field after it is a store into the caller's array.
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

const task = (p: Box): i32 => {
  const h = new Held();
  h.xs = p.ys;
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

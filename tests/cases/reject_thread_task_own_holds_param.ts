// An object the task makes holds its argument's array from its constructor
// on: a store through the object's field is a store into the caller's array.
import { scope } from "nish/threads";

class Box {
  ys: i32[];

  constructor() {
    this.ys = [0];
  }
}

class Held {
  xs: i32[];

  constructor(xs: i32[]) {
    this.xs = xs;
  }
}

const task = (p: Box): i32 => {
  const h = new Held(p.ys);
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

// A method of the object the task made keeps the argument's array in a
// field: a method is a call like any other, and the push after it is shared.
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

  adopt(ys: i32[]): void {
    this.xs = ys;
  }
}

const task = (p: Box): i32 => {
  const h = new Held();
  h.adopt(p.ys);
  h.xs.push(1);
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

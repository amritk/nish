// A helper that returns either of its arguments may return the caller's array,
// so the array it answers is not the task's own even when one argument is.
import { scope } from "nish/threads";

class Box {
  ys: i32[];

  constructor() {
    this.ys = [0];
  }
}

const either = (a: i32[], b: i32[], n: i32): i32[] => {
  if (n > 0) {
    return a;
  }
  return b;
};

const task = (p: Box): i32 => {
  const own = [0];
  const xs = either(own, p.ys, 0);
  xs[0] = 1;
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

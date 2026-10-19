// A task's first declarator makes an array of its own and the second binds
// its argument's: the second name is not the task's because it shares a
// statement with a fresh one, so the write through it is refused.
import { scope } from "nish/threads";

class Box {
  ys: i32[];

  constructor() {
    this.ys = [0];
  }
}

const task = (p: Box): i32 => {
  const xs = new Array<i32>(4), ys = p.ys;
  ys[0] = 1;
  return xs.length;
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

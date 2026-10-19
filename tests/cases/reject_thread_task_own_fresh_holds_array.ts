// A helper that answers its argument or a fresh array holding the caller's
// `ys`: the fresh outer array is the task's, but the inner one it holds is
// not, so a write below the answer's top level is refused.
import { scope } from "nish/threads";

class Box {
  ys: i32[];

  constructor() {
    this.ys = [0];
  }
}

const pick = (a: i32[][], ys: i32[], n: i32): i32[][] => {
  if (n > 0) {
    return a;
  }
  return [ys];
};

const task = (p: Box): i32 => {
  const own: i32[][] = [[0]];
  const r = pick(own, p.ys, 0);
  r[0][0] = 1;
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

// Every declarator of a statement is a use: the third pushes the array the
// second allocates onto an array the argument holds, so that array is not
// private, and the push is a shared write.
import { scope } from "nish/threads";

class Holder {
  all: i32[][];

  constructor() {
    this.all = [];
  }
}

const twice = (h: Holder): i32 => {
  const k: i32 = 2,
    xs = new Array<i32>(4),
    n = h.all.push(xs);
  xs[0] = k;
  return n;
};

export const main = (): i32 => {
  const h = new Holder();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(twice, h, out, 0);
  }
  return out[0];
};

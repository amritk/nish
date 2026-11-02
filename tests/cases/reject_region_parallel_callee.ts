// NL2351: a parallel body that reaches `region` through a callee.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";
import { parallelMap } from "nish/threads";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const count = (b: Box): i32 => b.n;

const work = (x: i32): i32 => {
  const r = region((): Box => new Box());
  const k = enter(r, count);
  free(r);
  return k + x;
};

export const main = (): i32 => {
  const ys = parallelMap([1, 2, 3], (x: i32): i32 => work(x));
  return ys.length;
};

// NL2371: a spawned function may not enter a region: the task's thread has
// an arena of its own.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";
import { scope } from "nish/threads";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const count = (b: Box): i32 => b.n;

const run = (n: i32): i32 => {
  const r = region((): Box => new Box());
  const k = enter(r, count);
  free(r);
  return k + n;
};

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(run, 1, out, 0);
  }
  return out[0];
};

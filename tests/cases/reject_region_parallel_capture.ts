// NL2613: a parallel body that captures a handle runs on other threads.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";
import { parallelMap } from "nish/threads";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const addN = (b: Box, x: i32): i32 => b.n + x;

export const main = (): i32 => {
  const r = region((): Box => new Box());
  const xs: i32[] = [1, 2, 3];
  const ys = parallelMap(xs, (x: i32): i32 => enterWith(r, x, addN));
  free(r);
  return ys.length;
};

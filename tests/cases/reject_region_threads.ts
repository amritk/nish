// NL2612: the function a region runs spawns a task, whose thread allocates
// from an arena of its own, not from the region.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";
import { scope } from "nish/threads";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const twice = (n: i32): i32 => n * 2;

const make = (): Box => {
  const b = new Box();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(twice, 21, out, 0);
  }
  b.n = out[0];
  return b;
};

export const main = (): i32 => {
  const r = region(make);
  free(r);
  return 0;
};

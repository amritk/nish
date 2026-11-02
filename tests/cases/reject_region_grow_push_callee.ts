// NL2615: the outer array grows in a callee of `enterWith`'s function.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const add = (out: i32[], n: i32): void => {
  out.push(n);
};

const serve = (b: Box, out: i32[]): i32 => {
  add(out, b.n);
  return 0;
};

export const main = (): i32 => {
  const r = region((): Box => new Box());
  const out: i32[] = [];
  enterWith(r, out, serve);
  free(r);
  return out.length;
};

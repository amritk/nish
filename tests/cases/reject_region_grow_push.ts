// NL2615: `out.push` inside `enterWith`'s function grows storage outside the
// region from the region's arena.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const serve = (b: Box, out: i32[]): i32 => {
  out.push(b.n);
  return 0;
};

export const main = (): i32 => {
  const r = region((): Box => new Box());
  const out: i32[] = [];
  enterWith(r, out, serve);
  free(r);
  return out.length;
};

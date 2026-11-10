// NL2615: a handle reaching `enter` through a parameter of a type `child`
// answers may be a child's, even when every caller hands a plain region, so
// its `enter` may not grow the root.
import { Region, child, enter, free, region } from "nish:region";

class Box {
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const make = (): Box => new Box();
const spawnChild = (root: Box): Region<Box> => child(make);
const grow = (root: Box): i32 => {
  root.items.push(1);
  return root.items.length;
};
const growIn = (r: Region<Box>): i32 => enter(r, grow);

export const main = (): i32 => {
  const p = region(make);
  enter(p, spawnChild);
  const n = growIn(p);
  free(p);
  return n;
};

// NL2614: the child's builder answers a helper's result, and the helper
// pushes what it is handed onto the array it answers, so the check on what
// the child stores never sees it. Only the builder's own body may keep what
// it is handed.
import { Region, childWith, enter, free, region } from "nish:region";

class Box {
  n: i32 = 1;
}

class Wrap {
  items: Box[];
  constructor() {
    this.items = [];
  }
}

const mk = (g: Box): Wrap => {
  const w = new Wrap();
  w.items.push(g);
  return w;
};

const build = (g: Box): Wrap => mk(g);
const keep = (root: Box): Region<Wrap> => childWith(new Box(), build);

export const main = (): i32 => {
  const p = region((): Box => new Box());
  enter(p, keep);
  free(p);
  return 0;
};

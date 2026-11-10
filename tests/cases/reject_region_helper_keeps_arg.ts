// NL2614: the builder answers a helper's result, and the helper pushes the
// outer argument onto the array it answers, so the region would keep memory
// from outside it. Only the builder's own body may keep what it is handed,
// where the region walk checks the store.
import { Region, enter, free, regionWith } from "nish:region";

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

const size = (w: Wrap): i32 => w.items.length;

export const main = (): i32 => {
  const outer = new Box();
  const r: Region<Wrap> = regionWith(outer, (g: Box): Wrap => mk(g));
  const n = enter(r, size);
  free(r);
  return n;
};

// NL2609: an arrow handed to a user function runs inside the region, so its
// body is judged as `keep`'s own: it keeps the region's root in `h`.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  child: Box | null = null;
}

class Holder {
  box: Box | null = null;
  node: Box | null = null;
  xs: i32[];
  constructor() {
    this.xs = [];
  }
}

const mk = (): Box => new Box();
const each = (cb: () => void): void => {
  cb();
};

const keep = (b: Box, h: Holder): i32 => {
  each(() => {
    h.box = b;
  });
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  h.node = new Box();
  const r = region(mk);
  const n = enterWith(r, h, keep);
  free(r);
  return n;
};

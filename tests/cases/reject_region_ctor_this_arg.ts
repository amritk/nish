// NL2609: a constructor run inside the region stores `this` into the
// outside value `regionWith` handed in (`h.l = this` with `h` the arg).
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Holder {
  l: Link | null = null;
}

class Link {
  n: i32;
  constructor(h: Holder) {
    this.n = 1;
    h.l = this;
  }
}

const make = (h: Holder): Link => new Link(h);

export const main = (): i32 => {
  const h = new Holder();
  const r = regionWith(h, make);
  free(r);
  return 0;
};

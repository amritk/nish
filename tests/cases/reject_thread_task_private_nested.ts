// A task's own array is private, and what its slots hold is not: `rows[0]`
// is the argument's array, so the store into it is a shared write.
import { scope } from "nish/threads";

class Holder {
  xs: i32[];

  constructor() {
    this.xs = [0, 0];
  }
}

const poke = (h: Holder): i32 => {
  const rows: i32[][] = [];
  rows.push(h.xs);
  rows[0][0] = 1;
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(poke, h, out, 0);
  }
  return out[0];
};

// `uncheckedSet` writes an element of its receiver as `xs[i] = v` does, so a
// parallel body that calls it on an array its caller can see is refused by
// the shared-write rule (`reject_par_shared_write`), unchecked or not.
import { parallelMapInto } from "nish/threads";
import { uncheckedSet } from "nish:unsafe";

class Hist {
  bins: u8[];
  constructor() {
    this.bins = [0, 0];
  }
}

const bump = (h: Hist): i32 => {
  uncheckedSet(h.bins, 0, toU8(1));
  return 0;
};

export const main = (): i32 => {
  const hs: Hist[] = [new Hist(), new Hist()];
  const out: i32[] = [0, 0];
  parallelMapInto(hs, out, bump);
  return out[0];
};

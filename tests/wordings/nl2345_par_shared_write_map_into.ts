// NL2345: a data-parallel body writes nothing its caller can see. `tally` adds
// to the `Tally` each element points at, from every thread at once.
import { parallelMapInto } from "nish/threads";

class Tally {
  n: i32 = 0;
}

const tally = (t: Tally): i32 => {
  t.n = t.n + 1;
  return t.n * 2;
};

export const main = (): i32 => {
  const src: Tally[] = [new Tally(), new Tally()];
  const dst: i32[] = [0, 0];
  parallelMapInto(src, dst, tally);
  return dst[0];
};

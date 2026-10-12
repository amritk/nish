// A task's own array is private only while nothing hands it out: `build`
// returns the array it fills, so its stores are to memory its caller holds,
// and the task that calls it writes what `build` writes.
import { scope } from "nish/threads";

const build = (n: i32): i32[] => {
  const xs = new Array<i32>(n);
  xs[0] = n;
  return xs;
};

const first = (n: i32): i32 => {
  const ys = build(n);
  return ys[0];
};

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(first, 4, out, 0);
  }
  return out[0];
};

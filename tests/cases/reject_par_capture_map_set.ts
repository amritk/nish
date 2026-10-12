// A `set` on a captured `Map` writes its table.
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const m = new Map<i32, i32>();
  const ys = parallelMap([1, 2], (x): i32 => {
    m.set(x, x);
    return x;
  });
  return ys[0];
};

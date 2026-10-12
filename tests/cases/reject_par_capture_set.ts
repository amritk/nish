// `set` copies into the captured array.
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const t: i32[] = [1, 2];
  const u: i32[] = [3, 4];
  const ys = parallelMap([1, 2], (x): i32 => {
    t.set(u);
    return x;
  });
  return ys[0];
};

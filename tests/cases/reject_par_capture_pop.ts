// `pop` moves the captured array's length, which every thread reads.
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const t: i32[] = [1, 2];
  const ys = parallelMap([1, 2], (x) => t.pop() + x);
  return ys[0];
};

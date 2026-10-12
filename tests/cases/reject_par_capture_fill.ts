// `fill` writes every element of the captured array.
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const t: i32[] = [1, 2];
  const ys = parallelMap([1, 2], (x): i32 => {
    t.fill(x);
    return x;
  });
  return ys[0];
};

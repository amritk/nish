// An element update is the one shared write a parallel body may make:
// `log[0] = x` rides along beside it and is refused.
import { AtomicI32Array, parallelMap } from "nish/threads";
export const main = (): i32 => {
  const bins = new AtomicI32Array(4);
  const log: i32[] = [0];
  const xs: i32[] = [1, 2, 3, 4];
  const ys = parallelMap(xs, (x: i32): i32 => {
    bins.add(x % 4, 1);
    log[0] = x;
    return x;
  });
  return ys.length + bins.load(0);
};

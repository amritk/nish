// An atomic op is the one shared write a parallel body may make: `log[0] = x`
// rides along beside it and is refused.
import { AtomicI32, parallelMap } from "nish/threads";
export const main = (): i32 => {
  const hits = new AtomicI32(0);
  const log: i32[] = [0];
  const xs: i32[] = [1, 2, 3, 4];
  const ys = parallelMap(xs, (x: i32): i32 => {
    hits.add(x);
    log[0] = x;
    return x;
  });
  return ys.length + hits.load();
};

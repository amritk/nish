// ... and an inner arrow reading the outer arrow's own parameter is the same
// capture through a nested arrow.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const xs: i32[] = [1, 2];
  const ys = parallelMap([1, 2], (x) => parallelMap(xs, (y) => y + x)[0]);
  return ys[0];
};

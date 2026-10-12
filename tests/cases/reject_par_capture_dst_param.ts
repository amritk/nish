// Two parameters may be the same array, and here they are.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

const run = (dst: i32[], t: i32[]): void => {
  parallelMapInto([1, 2], dst, (x) => t[0] + x);
};

export const main = (): i32 => {
  const d: i32[] = [0, 0];
  run(d, d);
  return d[0];
};

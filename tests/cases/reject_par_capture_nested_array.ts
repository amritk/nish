// An element of a captured array of arrays is memory the caller owns.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const grid: i32[][] = [[1], [2]];
  const ys = parallelMap([0, 1], (x): i32 => {
    grid[x][0] = 5;
    return x;
  });
  return ys[0];
};

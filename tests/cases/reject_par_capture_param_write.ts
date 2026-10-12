// A captured parameter is read-only as a captured local is.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

const fill = (t: i32[]): i32[] =>
  parallelMap([1, 2], (x): i32 => {
    t[0] = x;
    return x;
  });

export const main = (): i32 => fill([0, 0])[0];

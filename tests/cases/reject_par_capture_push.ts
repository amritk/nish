// `push` moves the captured array's header, which every thread holds.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const log: i32[] = [];
  const ys = parallelFrom(2, (i): i32 => {
    log.push(i);
    return i;
  });
  return ys[0] + log.length;
};

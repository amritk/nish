// NL2497: a body reads `dst` itself through a capture, while other threads
// write it.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const dst: i32[] = [0, 0];
  parallelMapInto([1, 2], dst, (x) => dst[0] + x);
  return dst[0];
};

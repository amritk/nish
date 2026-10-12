// ... and for `parallelMapInto`'s body.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const dst: i32[] = [0, 0];
  const hits: i32[] = [0];
  parallelMapInto([1, 2], dst, (x): i32 => {
    hits[0] = x;
    return x;
  });
  return dst[0];
};

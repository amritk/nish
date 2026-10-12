// `parallelFrom`'s result is a number, a `boolean` or an enum, as every
// data-parallel form's is: a string would point into a worker's arena.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const names = parallelFrom(2, (i) => `n${i}`);
  return names.length;
};

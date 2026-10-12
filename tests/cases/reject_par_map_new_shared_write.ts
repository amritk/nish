// `parallelMap`'s body is held to the rules `parallelMapInto`'s is: here it
// writes the console, which every thread shares.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const ys = parallelMap([1, 2], (x): i32 => {
    console.log(`${x}`);
    return x;
  });
  return ys[0];
};

// Handing the capture to a helper that writes it is a write the body makes.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

const poke = (p: i32[], v: i32): i32 => {
  p[0] = v;
  return v;
};

export const main = (): i32 => {
  const t: i32[] = [1, 2];
  const ys = parallelMap([1, 2], (x) => poke(t, x));
  return ys[0];
};

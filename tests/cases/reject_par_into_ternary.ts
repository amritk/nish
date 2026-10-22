// #612: a ternary that can answer the fresh destination may be it.
import { parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  const pick = src[0] > 0;
  const w = pick ? d : weights;
  parallelMapInto(src, d, (x) => w[x % 4] + 1);
  return d[0];
};

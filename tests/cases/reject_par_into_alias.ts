// #612: a second `const` bound to a fresh destination is the destination.
import { parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  const e = d;
  parallelMapInto(src, d, (x) => e[x % 4] + weights[0]);
  return d[0];
};

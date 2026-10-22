// #612: the body reading the destination itself stays refused, beside a
// captured array the new rule would otherwise admit.
import { parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  parallelMapInto(src, d, (x) => d[x % 4] + weights[x % 4]);
  return d[0];
};

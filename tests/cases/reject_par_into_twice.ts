// #612: a second call writing the same destination comes after the first,
// which handed it on as its own `dst`; the second is refused like any other
// use before it.
import { parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  const ts: i32[][] = [weights];
  parallelMapInto(src, d, (x) => x + 1);
  parallelMapInto(src, d, (x) => ts[0][x % 4] + 1);
  return d[0];
};

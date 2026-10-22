// #612: the destination passed as the call's own `src` is a use the call
// does not own as `dst`.
import { parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  const ts: i32[][] = [weights];
  parallelMapInto(d, d, (x) => ts[0][(x + 4) % 4] + 1);
  return d[0];
};

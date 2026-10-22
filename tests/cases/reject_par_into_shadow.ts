// #612: a destination name bound twice in the function is not proved
// unshared, even when the second binding is a block's own, after the call.
import { parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  const ts: i32[][] = [weights];
  parallelMapInto(src, d, (x) => ts[0][x % 4] + 1);
  let r: i32 = d[0];
  if (r > 0) {
    const d = new Array<i32>(2);
    r = r + d.length;
  }
  return r;
};

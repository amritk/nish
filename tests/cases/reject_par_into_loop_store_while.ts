// #612: as `reject_par_into_loop_store`, around a `while` loop: the store after
// the call runs before the next pass's call.
import { parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  const ts: i32[][] = [weights];
  let i: i32 = 0;
  while (i < 2) {
    i = i + 1;
    parallelMapInto(src, d, (x) => ts[ts.length - 1][x % 4] + 1);
    ts.push(d);
  }
  return d[0];
};

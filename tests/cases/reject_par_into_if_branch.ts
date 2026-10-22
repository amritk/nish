// #612: a hand-on on one branch of an `if` before the call may have run, so
// the destination may be one of the captured rows.
import { parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  const ts: i32[][] = [weights];
  if (src[0] > 0) {
    ts.push(d);
  }
  parallelMapInto(src, d, (x) => ts[ts.length - 1][x % 4] + 1);
  return d[0];
};

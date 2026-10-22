// #612: a store after the call inside a loop around it happens before the
// next pass's call, which then writes the row the body reads.
import { parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  const ts: i32[][] = [weights];
  for (let i: i32 = 0; i < 2; i = i + 1) {
    parallelMapInto(src, d, (x) => ts[ts.length - 1][x % 4] + 1);
    ts.push(d);
  }
  return d[0];
};

// #612: with `d` declared outside both loops, a store after the inner loop is
// still inside the outer one, whose next pass runs it before the call.
import { parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  const ts: i32[][] = [weights];
  for (let i: i32 = 0; i < 2; i = i + 1) {
    for (let j: i32 = 0; j < 2; j = j + 1) {
      parallelMapInto(src, d, (x) => ts[ts.length - 1][x % 4] + 1);
    }
    ts.push(d);
  }
  return d[0];
};

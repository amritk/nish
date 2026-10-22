// #612: a fresh destination pushed onto a captured list of rows is one of
// those rows.
import { parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = new Array<i32>(4);
  const ts: i32[][] = [weights];
  ts.push(d);
  parallelMapInto(src, d, (x) => ts[1][x % 4] + 1);
  return d[0];
};

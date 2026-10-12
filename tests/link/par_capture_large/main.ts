// WP29: captures through a region that divides. Two million elements are past
// every body's grain here, so each region runs on as many threads as the
// machine has, and every thread reads the captured scalar and the captured
// table out of the region's context. The checksums are the same however many
// threads there were.
import { parallelFrom, parallelMap, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const n: i32 = 2000000;
  const k: i32 = 7;
  const table: i32[] = [3, 1, 4, 1, 5, 9, 2, 6];
  const xs = parallelFrom(n, (i) => (i * k) % 1000);
  const ys = parallelMap(xs, (x) => x + table[x % 8] * k);
  const total = parallelReduce(ys, (a, c) => a + c, 0);
  console.log(`${xs[1999999]} ${ys[0]} ${ys[1048576]} ${total}`);
  return 0;
};

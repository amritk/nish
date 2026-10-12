// WP29: captures through a region that divides. Two million elements are past
// every body's grain here, and two blocks of a reduce are two chunks, so each
// region runs on as many threads as the machine has, and every thread reads
// the captured scalars and the captured table out of the region's context. The checksums are the same however many
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
  // A reduce over two blocks of 2^20 divides too, and its operator reads a
  // captured array and a captured scalar on each thread. A clamped maximum is
  // associative, and 0 is its identity on these non-negative elements.
  const lim: i32 = table[5] * k * 15;
  const top = parallelReduce(
    ys,
    (a, c): i32 => {
      const m = a > c ? a : c;
      return m < lim + table[0] ? m : lim + table[0];
    },
    0
  );
  console.log(`${top}`);
  return 0;
};

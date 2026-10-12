// The same read in a region long enough to divide across threads.
import { parallelFrom, scope } from "nish/threads";

const work = (n: i32): i32 => n * 2;

export const main = (): i32 => {
  const sums: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(work, 21, sums, 0);
    s.spawn(work, 50, sums, 1);
    const ys = parallelFrom(3000000, (i) => (sums[0] + sums[1]) * 3 + (i % 1000));
    console.log(`${ys[0]}`);
  }
  return sums[0];
};

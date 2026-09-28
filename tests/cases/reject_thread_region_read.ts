// Between a scope's first `spawn` and the end of its block, its thread may not
// read an array a task stores into: natively `sums[0]` is still 0 here, and
// under Node the task has already stored 6.
import { scope } from "nish/threads";

const sumOf = (xs: i32[]): i32 => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const sums: i32[] = [0];
  {
    using s = scope();
    s.spawn(sumOf, xs, sums, 0);
    console.log(`${sums[0]}`);
  }
  return sums[0];
};

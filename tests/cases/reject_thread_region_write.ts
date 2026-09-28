// Between a scope's first `spawn` and the end of its block, its thread may not
// write memory a task may read: natively the task reads `xs` at the join and
// would sum 105, and under Node it already summed 6 at the spawn.
import { scope } from "nish/threads";

const sumOf = (xs: f64[]): i32 => {
  let t: f64 = 0.0;
  for (const x of xs) {
    t = t + x;
  }
  return toI32(t);
};

export const main = (): i32 => {
  const xs: f64[] = [1.0, 2.0, 3.0];
  const sums: i32[] = [0];
  {
    using s = scope();
    s.spawn(sumOf, xs, sums, 0);
    xs[0] = 100.0;
  }
  return sums[0];
};

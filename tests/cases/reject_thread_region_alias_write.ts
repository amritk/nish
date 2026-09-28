// The region's write rule holds through an alias: `ys` is `xs` by another name,
// and a store through it is the same write.
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
    const ys = xs;
    ys[0] = 100.0;
  }
  return sums[0];
};

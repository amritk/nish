// WP34 N2: `fill` writes the receiver's elements, so in a scope's region it is
// refused as a store to `xs[i]` is while a task may be reading `xs`.
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
    xs.fill(0.0);
  }
  return sums[0];
};

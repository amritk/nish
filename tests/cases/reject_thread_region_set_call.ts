// WP34 N2: a function whose only write is `dst.set(src)` writes through the
// array it is handed, so calling it on memory a task may read is refused.
import { scope } from "nish/threads";

const sumOf = (xs: f64[]): i32 => {
  let t: f64 = 0.0;
  for (const x of xs) {
    t = t + x;
  }
  return toI32(t);
};

const reset = (xs: f64[], from: f64[]): void => {
  xs.set(from);
};

export const main = (): i32 => {
  const xs: f64[] = [1.0, 2.0, 3.0];
  const zeros: f64[] = [0.0, 0.0, 0.0];
  const sums: i32[] = [0];
  {
    using s = scope();
    s.spawn(sumOf, xs, sums, 0);
    reset(xs, zeros);
  }
  return sums[0];
};

// The region's write rule holds through a call: `scale` writes the array it is
// handed, which the task is reading.
import { scope } from "nish/threads";

const sumOf = (xs: f64[]): i32 => {
  let t: f64 = 0.0;
  for (const x of xs) {
    t = t + x;
  }
  return toI32(t);
};

const scale = (xs: f64[]): void => {
  for (let i: i32 = 0; i < toI32(xs.length); i++) {
    xs[i] = xs[i] * 2.0;
  }
};

export const main = (): i32 => {
  const xs: f64[] = [1.0, 2.0, 3.0];
  const sums: i32[] = [0];
  {
    using s = scope();
    s.spawn(sumOf, xs, sums, 0);
    scale(xs);
  }
  return sums[0];
};

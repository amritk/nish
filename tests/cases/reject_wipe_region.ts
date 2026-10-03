// #385: `secureZero(a)` writes `a`'s elements, so in a scope's region it is
// refused as `a.fill(0)` is while a task may be reading `a`.
import { scope } from "nish/threads";

const sumOf = (xs: u8[]): i32 => {
  let t = 0;
  for (const x of xs) {
    t = t + toI32(x);
  }
  return t;
};

export const main = (): i32 => {
  const xs: u8[] = [1, 2, 3];
  const sums: i32[] = [0];
  {
    using s = scope();
    s.spawn(sumOf, xs, sums, 0);
    secureZero(xs);
  }
  return sums[0];
};

// WP34 N5: `pollWait` writes `ready`'s elements, so in a scope's region it is
// refused as `ready.fill(v)` is while a task may be reading `ready`.
import { scope } from "nish/threads";

const sumOf = (xs: i32[]): i32 => {
  let t = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

export const main = (): i32 => {
  const ready: i32[] = [0, 0];
  const sums: i32[] = [0];
  {
    using s = scope();
    s.spawn(sumOf, ready, sums, 0);
    pollWait(3, ready, 0);
  }
  return sums[0];
};

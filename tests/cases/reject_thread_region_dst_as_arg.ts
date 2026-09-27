// A destination is never handed on, not even to a later task: under Node the
// first task has stored into `out` by the time the second reads it, and
// natively it stores only when the scope joins.
import { scope } from "nish/threads";

const total = (xs: i32[]): i32 => {
  let t: i32 = 0;
  for (const x of xs) {
    t = t + x;
  }
  return t;
};

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const out: i32[] = [0];
  const out2: i32[] = [0];
  {
    using s = scope();
    s.spawn(total, xs, out, 0);
    s.spawn(total, out, out2, 0);
  }
  return out2[0];
};

// Only an arrow written directly in a function's body captures: an arrow
// inside a task's arrow reads nothing from outside itself.
import { parallelMap, scope } from "nish/threads";

class Tally {
  total: i32 = 0;
}

export const main = (): i32 => {
  const k: i32 = 3;
  const xs: i32[] = [1, 2];
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn((n: i32): i32 => parallelMap(xs, (x) => x * k)[0] + n, 1, out, 0);
  }
  return out[0];
};

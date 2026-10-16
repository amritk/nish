// NL2506: an arrow given to `spawn` reads a `let` of the function it is
// written in, which could change before the task runs.
import { scope } from "nish/threads";

export const main = (): i32 => {
  let k: i32 = 3;
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn((n: i32): i32 => n + k, 1, out, 0);
  }
  k = 4;
  return out[0];
};

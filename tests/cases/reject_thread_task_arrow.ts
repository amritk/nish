// The task given to `spawn` is a top-level function named at the call; an
// arrow written there is refused, where `parallelMapInto` would take it.
import { scope } from "nish/threads";

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn((n: i32): i32 => n + 1, 1, out, 0);
  }
  return out[0];
};

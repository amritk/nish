// A `spawn` inside a `using a = arena()` block may not file a task on a scope
// declared outside it: the task runs when that scope joins, after the release.
import { scope } from "nish/threads";

const triple = (n: i32): i32 => n * 3;

export const main = (): i32 => {
  const out: i32[] = [0];
  using s = scope();
  {
    using a = arena();
    s.spawn(triple, 2, out, 0);
  }
  return 0;
};

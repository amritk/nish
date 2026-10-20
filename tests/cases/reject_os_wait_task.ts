// WP34 N12: `waitPid` reaps a child, which no later call can undo, so a
// `scope()` task may not reap one.
import { scope } from "nish/threads";

const reap = (pid: i32): i32 => waitPid(pid, 1)[1];

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(reap, -1, out, 0);
  }
  return out[0];
};

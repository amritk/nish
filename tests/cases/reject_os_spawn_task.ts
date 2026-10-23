// WP34 N12: `spawn` starts a process, a write its caller can see, so a
// `scope()` task may not make one.
import { scope } from "nish/threads";

const start = (n: i32): i32 => spawn(["/bin/true"]) + n;

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(start, 0, out, 0);
  }
  return out[0];
};

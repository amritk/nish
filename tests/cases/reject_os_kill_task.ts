// WP34 N12: `kill` sends a signal, a write its caller can see, so a `scope()`
// task may not send one.
import { scope } from "nish/threads";

const stop = (pid: i32): i32 => kill(pid, 15);

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(stop, 1, out, 0);
  }
  return out[0];
};

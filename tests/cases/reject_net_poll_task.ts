// WP34 N5: waiting on a loop changes the kernel's state of it and writes
// `ready`, so a `scope()` task may not wait.
import { scope } from "nish/threads";

const wait = (loop: i32): i32 => {
  const ready: i32[] = [0, 0];
  return pollWait(loop, ready, 0);
};

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(wait, 3, out, 0);
  }
  return out[0];
};

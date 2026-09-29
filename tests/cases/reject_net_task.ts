// WP34 N5: every `nish:net` call changes the kernel's state of a socket, a
// write its caller can see, so a `scope()` task may not make one.
import { scope } from "nish/threads";

const hangUp = (fd: i32): i32 => netClose(fd);

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(hangUp, 3, out, 0);
  }
  return out[0];
};

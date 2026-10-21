// WP34 N12: the refusal follows the builtin, not its spelling, so `kill`
// imported under another name is refused in a task as the global is.
import { kill as k } from "nish:process";
import { scope } from "nish/threads";

const stop = (pid: i32): i32 => k(pid, 15);

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(stop, 1, out, 0);
  }
  return out[0];
};

// WP34 N12: a parallel body may write nothing but its result, and a signal
// changes the state of another process.
import { parallelMapInto } from "nish/threads";

const stop = (pid: i32): i32 => kill(pid, 0);

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  parallelMapInto([1, 2], out, stop);
  return out[0];
};

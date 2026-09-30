// WP34 N5: a parallel body may write nothing but its result, and watching a
// descriptor changes the kernel's state of the loop.
import { parallelMapInto } from "nish/threads";

const watch = (fd: i32): i32 => pollAdd(3, fd, 1, fd);

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  parallelMapInto([4, 5], out, watch);
  return out[0];
};

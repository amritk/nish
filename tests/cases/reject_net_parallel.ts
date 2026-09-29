// WP34 N5: a parallel body may write nothing but its result, and a read from a
// socket moves the kernel's state of it.
import { parallelMapInto } from "nish/threads";

const poll = (fd: i32): i32 => {
  const buf: u8[] = new Array<u8>(4);
  return netRead(fd, buf, 0, 4);
};

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  parallelMapInto([3, 4], out, poll);
  return out[0];
};

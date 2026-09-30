// WP34 N5: a parallel body may write nothing but its result, and binding a
// socket moves the kernel's state.
import { parallelMapInto } from "nish/threads";

const open = (port: i32): i32 => udpBind("127.0.0.1", port, 0);

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  parallelMapInto([3, 4], out, open);
  return out[0];
};

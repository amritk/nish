// `sendFd` and `recvFd` check `0 <= off <= off + len <= buf.length` before the
// call, as `netRead` and `netWrite` do (`net_tcp_bounds`), through the slice
// panic `set` uses and with its words. In range, the call reaches the runtime,
// which answers -9 for the closed socket; `net_unix_scm_bounds.c` runs each
// range that is not in a child and prints its message and its exit status.
import { recvFd, sendFd } from "nish:net";

const sendAt = (off: i32, len: i32): i32 => {
  const buf: u8[] = [1, 2, 3, 4, 5, 6, 7, 8];
  return sendFd(-1, 0, buf, off, len);
};

const recvAt = (off: i32, len: i32): i32 => {
  const buf: u8[] = new Array<u8>(8);
  const fd: i32[] = [0];
  return recvFd(-1, buf, off, len, fd);
};

export const sendPastEnd = (): i32 => sendAt(4, 5);

export const recvNegativeOffset = (): i32 => recvAt(-1, 2);

export const recvNegativeLength = (): i32 => recvAt(2, -1);

export const test = (): i32 => sendAt(0, 8) + recvAt(7, 1);

// The two ends' shared wire: the messages and the waiting read (`main.ts`).
import { netClose, netRead, pollAdd, pollCreate, pollWait } from "nish:net";

/** "ping", the child's message. */
export const ping = (): u8[] => [112, 105, 110, 103];
/** "pong", the parent's answer. */
export const pong = (): u8[] => [112, 111, 110, 103];

/** Wait up to five seconds for `fd` to be readable: whether it is. */
export const readable = (fd: i32): boolean => {
  const loop = pollCreate();
  pollAdd(loop, fd, 1, 0);
  const ready: i32[] = [0, 0];
  const n = pollWait(loop, ready, 5000);
  netClose(loop);
  return n > 0;
};

/** Read exactly `buf.length` bytes from `fd`, waiting between reads: how many came. */
export const readAll = (fd: i32, buf: u8[]): i32 => {
  let got = 0;
  while (got < buf.length && readable(fd)) {
    const n = netRead(fd, buf, got, buf.length - got);
    if (n <= 0) {
      return got;
    }
    got += n;
  }
  return got;
};

/** Whether `a` and `b` hold the same bytes. */
export const same = (a: readonly u8[], b: readonly u8[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

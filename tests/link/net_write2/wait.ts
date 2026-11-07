// The bounded waits the program reads and writes with: poll for one event,
// and read a buffer whole.
import { netClose, netRead, pollAdd, pollCreate, pollWait } from "nish:net";

/** Waits up to two seconds for `fd` to be ready for `events`; whether it is. */
export const ready = (fd: i32, events: i32): boolean => {
  const loop = pollCreate();
  pollAdd(loop, fd, events, 0);
  const out: i32[] = new Array<i32>(2);
  const n = pollWait(loop, out, 2000);
  netClose(loop);
  return n === 1;
};

/** Reads exactly `buf.length` bytes from `fd`, waiting as needed; whether they all came. */
export const readAll = (fd: i32, buf: u8[]): boolean => {
  let got: i32 = 0;
  let open = true;
  while (got < buf.length && open) {
    const n = netRead(fd, buf, got, buf.length - got);
    if (n > 0) {
      got = got + n;
    } else {
      open = n === -11 && ready(fd, 1);
    }
  }
  return got === buf.length;
};

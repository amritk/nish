// WP34 N5: a datagram sent changes the kernel's state of the socket, a write
// its caller can see, so a `scope()` task may not send one.
import { scope } from "nish/threads";

const ping = (fd: i32): i32 => {
  const buf: u8[] = [1];
  const to: u8[] = new Array<u8>(18);
  return udpSendTo(fd, buf, 0, 1, to, 0, 0);
};

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(ping, 3, out, 0);
  }
  return out[0];
};

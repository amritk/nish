// `tcpListenFlags` flag 2: every connection a listener opened with it accepts
// has `TCP_NODELAY` set, alone and beside flag 1's `SO_REUSEPORT`, while a
// connection taken from a flag-0 or flag-1 listener has it off as before. Each
// call opens a loopback listener with `flags`, connects to it, waits for the
// connection and answers the accepted descriptor; `net_tcp_nodelay.c` reads
// the option back from that descriptor with `getsockopt` and prints it. Bit 4
// and up, and a negative word, are still -22.
import { netAddress, netClose, netLocalPort, pollAdd, pollCreate, pollWait, tcpAccept, tcpConnect, tcpListenFlags } from "nish:net";

/** The connection a fresh loopback listener opened with `flags` accepts, or the failure. */
export const accepted = (flags: i32): i32 => {
  const listener = tcpListenFlags("127.0.0.1", 0, 4, flags);
  if (listener < 0) {
    return listener;
  }
  const addr: u8[] = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", netLocalPort(listener));
  const client = tcpConnect(addr);
  const loop = pollCreate();
  pollAdd(loop, listener, 1, 0);
  const ready: i32[] = new Array<i32>(2);
  const peer: u8[] = new Array<u8>(18);
  const conn = pollWait(loop, ready, 2000) === 1 ? tcpAccept(listener, peer) : -110;
  netClose(loop);
  netClose(client);
  netClose(listener);
  return conn;
};

/** `tcpListenFlags`' answer for `flags` on a loopback port, the socket closed. */
export const opened = (flags: i32): i32 => {
  const fd = tcpListenFlags("127.0.0.1", 0, 4, flags);
  if (fd >= 0) {
    netClose(fd);
    return 0;
  }
  return fd;
};

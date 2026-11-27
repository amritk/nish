// `NET_LISTEN_RING` and `netRingState` (WP63 S2), checked by `net_ring_calls.c`:
// what the state answers before a listen and after one, the flags
// tcpListenFlags takes with the ring bit and the wide bit, the -22 for the
// wide bit without the ring bit and past 31, an accept with
// nothing waiting, and the -9 a slot handle no listener issued answers on
// every path that takes one. The connections themselves are tests/run.js's
// `net_ring` section.
import {
  NET_LISTEN_RING,
  NET_LISTEN_RING_WIDE,
  netClose,
  netLocalPort,
  netRead,
  netRingState,
  netWrite,
  pollAdd,
  pollCreate,
  sendFd,
  tcpAccept,
  tcpListenFlags,
} from "nish:net";

/** What the first ring listen decided, or 0 before one. */
export const state = (): i32 => netRingState();

/** The ring bit's value. */
export const ringBit = (): i32 => NET_LISTEN_RING;

/** The wide-ring bit's value. */
export const wideBit = (): i32 => NET_LISTEN_RING_WIDE;

/** 0 when a loopback listen with `flags` succeeds (and is closed), else its failure. */
export const listenWith = (flags: i32): i32 => {
  const fd = tcpListenFlags("127.0.0.1", 0, 4, flags);
  if (fd < 0) {
    return fd;
  }
  netClose(fd);
  return 0;
};

/** A ring listener's tcpAccept with no connection waiting, and whether its port is known. */
export const emptyAccept = (): i32 => {
  const fd = tcpListenFlags("127.0.0.1", 0, 4, NET_LISTEN_RING);
  if (fd < 0) {
    return fd;
  }
  const peer: u8[] = new Array<u8>(18);
  const got = netLocalPort(fd) > 0 ? tcpAccept(fd, peer) : -1;
  netClose(fd);
  return got;
};

/** netRead of handle `h`. */
export const readOf = (h: i32): i32 => {
  const buf: u8[] = new Array<u8>(8);
  return netRead(h, buf, 0, 8);
};

/** netWrite of one byte to handle `h`. */
export const writeOf = (h: i32): i32 => {
  const buf: u8[] = [1];
  return netWrite(h, buf, 0, 1);
};

/** netClose of handle `h`. */
export const closeOf = (h: i32): i32 => netClose(h);

/** pollAdd of handle `h` to a fresh loop. */
export const pollOf = (h: i32): i32 => {
  const loop = pollCreate();
  const got = pollAdd(loop, h, 1, 0);
  netClose(loop);
  return got;
};

/** sendFd with handle `h` as the socket. */
export const sendOf = (h: i32): i32 => {
  const buf: u8[] = [1];
  return sendFd(h, 0, buf, 0, 1);
};

// `netMss`: the send MSS of both ends of a loopback connection, which
// `net_mss.c` checks is positive, and the plain -1 for every socket that has
// none to read: a listener, which has no peer, a bound UDP socket, a closed
// descriptor and one that was never open. Never an errno.
import {
  netAddress,
  netClose,
  netLocalPort,
  netMss,
  pollAdd,
  pollCreate,
  pollWait,
  tcpAccept,
  tcpConnect,
  tcpListen,
  udpBind,
} from "nish:net";

/**
 * The smaller of the two ends' MSS of a fresh loopback connection, read while
 * both are open; -110 when the listener saw no connection, or the failure.
 */
export const connected = (): i32 => {
  const listener = tcpListen("127.0.0.1", 0, 4);
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
  let mss = conn;
  if (conn >= 0) {
    const ours = netMss(client);
    const theirs = netMss(conn);
    mss = ours < theirs ? ours : theirs;
    netClose(conn);
  }
  netClose(loop);
  netClose(client);
  netClose(listener);
  return mss;
};

/** A listener: bound, but with no peer, so it has no MSS of its own. */
export const listening = (): i32 => {
  const fd = tcpListen("127.0.0.1", 0, 4);
  const mss = netMss(fd);
  netClose(fd);
  return mss;
};

/** A bound UDP socket, which is not TCP. */
export const datagram = (): i32 => {
  const fd = udpBind("127.0.0.1", 0, 0);
  const mss = netMss(fd);
  netClose(fd);
  return mss;
};

/** A descriptor that has been closed. */
export const closed = (): i32 => {
  const fd = tcpListen("127.0.0.1", 0, 4);
  netClose(fd);
  return netMss(fd);
};

/** `netMss` of any descriptor, for the ones the driver makes. */
export const mssOf = (fd: i32): i32 => netMss(fd);

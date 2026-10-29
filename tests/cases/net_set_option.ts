// `netSetOption`: each of the five whitelisted options, set on a connection a
// loopback listener accepted, which `net_set_option.c` reads back with
// `getsockopt`. `NET_SO_RCVBUF` is read by its global spelling and the other
// four through the import, so both ways a `nish:net` option id is named fold
// to the same constant. An id off the whitelist is -22 before the descriptor
// is looked at, and a closed descriptor is -9.
import {
  NET_SO_KEEPALIVE,
  NET_SO_SNDBUF,
  NET_TCP_NODELAY,
  NET_TCP_QUICKACK,
  netAddress,
  netClose,
  netLocalPort,
  netSetOption,
  pollAdd,
  pollCreate,
  pollWait,
  tcpAccept,
  tcpConnect,
  tcpListen,
} from "nish:net";

/** The connection a fresh loopback listener accepts, from `tcpAccept`, or the failure. */
export const accepted = (): i32 => {
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
  netClose(loop);
  netClose(client);
  netClose(listener);
  return conn;
};

export const setNodelay = (fd: i32, on: i32): i32 => netSetOption(fd, NET_TCP_NODELAY, on);
export const setQuickack = (fd: i32, on: i32): i32 => netSetOption(fd, NET_TCP_QUICKACK, on);
export const setKeepalive = (fd: i32, on: i32): i32 => netSetOption(fd, NET_SO_KEEPALIVE, on);
export const setSndbuf = (fd: i32, bytes: i32): i32 => netSetOption(fd, NET_SO_SNDBUF, bytes);
export const setRcvbuf = (fd: i32, bytes: i32): i32 => netSetOption(fd, NET_SO_RCVBUF, bytes);
/** `netSetOption` with a raw id, for the ones off the whitelist. */
export const setRaw = (fd: i32, option: i32): i32 => netSetOption(fd, option, 1);

/** `NET_TCP_NODELAY` on a socket that has been closed. */
export const closed = (): i32 => {
  const fd = tcpListen("127.0.0.1", 0, 4);
  netClose(fd);
  return netSetOption(fd, NET_TCP_NODELAY, 1);
};

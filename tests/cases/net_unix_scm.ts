// `sendFd`, `recvFd` and `peerCredentials` in one process (RT-37 to RT-39).
// `net_unix_scm.c` hands `attempt` a regular file, an unconnected TCP socket
// and a Unix stream pair of its own, and counts its descriptors around each
// call, which must not change: every refusal of the three calls has an attempt
// (a zero length, a negative descriptor, a short array, a descriptor that is
// not a socket, one that is a socket of another family, one that is not open,
// a peer that has gone, a message with nothing waiting), and so do the calls
// that succeed and close what they made. `carry` sends the file or the pair's
// far end over the pair and gives the driver the descriptor `recvFd` took,
// which it reads for close-on-exec, non-blocking and identity before it
// closes it; `gather` takes what the driver sent itself, three descriptors in
// one message or twelve, more than `recvFd` has room for, which must leave
// exactly one open and the bytes still read; `peer` reads one field of the
// credentials of a pair end, a connected socket and the accepted one, which
// the driver checks against its own pid, uid and gid.
import {
  NET_UNIX_STREAM,
  netClose,
  netWrite,
  peerCredentials,
  recvFd,
  sendFd,
  unixAccept,
  unixConnect,
  unixListen,
  unixSocketPair,
} from "nish:net";
import { unlinkSync } from "nish:fs";

/** The socket file `connected` makes, keyed by the driver's pid as its other scratch files are. */
const pathOf = (pid: i32): string => `build/test/nus-peer-${pid}.sock`;

/** A stream pair whose end 1 is closed: what end 0 sends meets a peer that has gone. */
const widowed = (): i32 => {
  const fds: i32[] = new Array<i32>(2);
  const made = unixSocketPair(NET_UNIX_STREAM, fds);
  if (made < 0) {
    return made;
  }
  netClose(fds[1]);
  return fds[0];
};

/** `recvFd` on `sock` into 8 bytes: the bytes read, then 1000 more when a descriptor came, which is closed. */
const drain = (sock: i32): i32 => {
  const buf: u8[] = new Array<u8>(8);
  const fd: i32[] = [7];
  const n = recvFd(sock, buf, 0, 8, fd);
  if (fd[0] >= 0) {
    netClose(fd[0]);
    return n + 1000;
  }
  return n;
};

/** A stream pair that `send` has sent over once: the reading end, the other closed, or the failure. */
const sentOver = (send: i32): i32 => {
  const fds: i32[] = new Array<i32>(2);
  const made = unixSocketPair(NET_UNIX_STREAM, fds);
  if (made < 0) {
    return made;
  }
  const answer = send === 0 ? netWrite(fds[0], [1, 2], 0, 2) : sendFd(fds[0], send, [1, 2], 0, 2);
  netClose(fds[0]);
  if (answer < 0) {
    netClose(fds[1]);
    return answer;
  }
  return fds[1];
};

/** The number of calls `attempt` makes. */
export const attempts = (): i32 => 25;

/** The `k`th call's answer, with `file` a regular file, `tcp` a TCP socket and `a` and `b` a stream pair. */
export const attempt = (k: i32, file: i32, tcp: i32, a: i32, b: i32): i32 => {
  const buf: u8[] = new Array<u8>(8);
  const fd: i32[] = [7];
  if (k === 0) {
    return sendFd(a, file, buf, 0, 0);
  }
  if (k === 1) {
    return sendFd(a, -1, buf, 0, 1);
  }
  if (k === 2) {
    return sendFd(file, file, buf, 0, 1);
  }
  if (k === 3) {
    return sendFd(tcp, file, buf, 0, 1);
  }
  if (k === 4) {
    return sendFd(1000, file, buf, 0, 1);
  }
  if (k === 5) {
    return sendFd(a, 1000, buf, 0, 1);
  }
  if (k === 6) {
    const sock = widowed();
    const answer = sock < 0 ? sock : sendFd(sock, file, buf, 0, 1);
    netClose(sock);
    return answer;
  }
  if (k === 7) {
    return recvFd(b, buf, 0, 0, fd);
  }
  if (k === 8) {
    return recvFd(b, buf, 0, 8, []);
  }
  if (k === 9) {
    return recvFd(file, buf, 0, 8, fd);
  }
  if (k === 10) {
    return recvFd(tcp, buf, 0, 8, fd);
  }
  if (k === 11) {
    return recvFd(1000, buf, 0, 8, fd);
  }
  if (k === 12) {
    return recvFd(b, buf, 0, 8, fd) * 10 + fd[0];
  }
  if (k === 13) {
    const sock = widowed();
    const answer = sock < 0 ? sock : recvFd(sock, buf, 0, 8, fd) * 10 + fd[0];
    netClose(sock);
    return answer;
  }
  if (k === 14) {
    const sock = sentOver(0);
    const answer = sock < 0 ? sock : recvFd(sock, buf, 0, 8, fd) * 10 + fd[0];
    netClose(sock);
    return answer;
  }
  if (k === 15) {
    const sock = sentOver(file);
    const answer = sock < 0 ? sock : drain(sock);
    netClose(sock);
    return answer;
  }
  if (k === 16) {
    const sock = sentOver(file);
    netClose(sock);
    return sock < 0 ? sock : 0;
  }
  if (k === 17) {
    return peerCredentials(a, [0, 0]);
  }
  if (k === 18) {
    return peerCredentials(file, [0, 0, 0]);
  }
  if (k === 19) {
    return peerCredentials(tcp, [0, 0, 0]);
  }
  if (k === 20) {
    return peerCredentials(1000, [0, 0, 0]);
  }
  if (k === 21) {
    return peerCredentials(a, [0, 0, 0]);
  }
  if (k === 22) {
    const sock = widowed();
    const answer = sock < 0 ? sock : peerCredentials(sock, [0, 0, 0]);
    netClose(sock);
    return answer;
  }
  if (k === 23) {
    return sendFd(a, file, buf, 0, 1) * 10 + drain(b);
  }
  return sendFd(a, a, buf, 0, 1) * 10000 + drain(b);
};

/** Send `fd` over `a` with one byte and take it from `b`: the descriptor `recvFd` took, or the failure. */
export const carry = (a: i32, b: i32, fd: i32): i32 => {
  const out: i32[] = [7];
  const sent = sendFd(a, fd, [42], 0, 1);
  if (sent !== 1) {
    return sent < 0 ? sent : -1000;
  }
  const n = recvFd(b, new Array<u8>(4), 0, 4, out);
  return n === 1 ? out[0] : n < 0 ? n : -1000;
};

/** What the driver sent over `b` itself: the bytes `recvFd` read, and the descriptor it kept into `kept[0]`. */
export const gather = (b: i32, kept: i32[]): i32 => recvFd(b, new Array<u8>(8), 0, 8, kept);

/** Field `k` (pid, uid, gid) of `fd`'s peer, or the failure. */
export const peer = (fd: i32, k: i32): i32 => {
  const out: i32[] = [0, 0, 0];
  const answer = peerCredentials(fd, out);
  return answer < 0 ? answer : out[k];
};

/** The `k`th of a listener at `pid`'s path, a connect to it and the accept of that connect on `listener`. */
export const connected = (k: i32, listener: i32, pid: i32): i32 => {
  if (k === 0) {
    unlinkSync(pathOf(pid));
    return unixListen(pathOf(pid), 4, 0);
  }
  return k === 1 ? unixConnect(pathOf(pid)) : unixAccept(listener);
};

/** Remove the socket file `connected` made for `pid`. */
export const release = (pid: i32): i32 => unlinkSync(pathOf(pid));

// No Unix-domain call leaves a descriptor open, counted the way the kernel
// lists them: the entries of /proc/self/fd (#1129, criterion 9). Linux only,
// so `tests/run.js` builds and runs this from its `net_unix` section on Linux
// and prints a skip line elsewhere; `tests/cases/net_unix_fds` is the portable
// count, by `fcntl`, of the same refusals. Each attempt below is one call's
// error path, or a round that succeeds and closes what it made, with a live
// listener, a dead socket file and a regular file set up beforehand. The
// listing opens a descriptor of its own while it reads, so it lists that one
// too, in the count before and the count after alike.
import {
  NET_UNIX_SEQPACKET,
  NET_UNIX_STREAM,
  NET_UNIX_UNLINK_STALE,
  netClose,
  netRead,
  netWrite,
  peerCredentials,
  recvFd,
  sendFd,
  unixAccept,
  unixConnect,
  unixListen,
  unixListenMode,
  unixSocketPair,
} from "nish:net";
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "nish:fs";

const DIR: string = "build/test/net-unix-proc-fds/";
const LIVE: string = "build/test/net-unix-proc-fds/live.sock";
const DEAD: string = "build/test/net-unix-proc-fds/dead.sock";
const FILE: string = "build/test/net-unix-proc-fds/file.sock";
const CYCLE: string = "build/test/net-unix-proc-fds/cycle.sock";
const IDLE: string = "build/test/net-unix-proc-fds/idle.sock";
/** The one byte each message carries. */
const byte = (): u8[] => [42];

/** The entries of /proc/self/fd, or -1 where there is no such directory. */
const openFds = (): i32 => {
  const names = readdirSync("/proc/self/fd");
  return names !== null ? names.length : -1;
};

/** A path of exactly `n` bytes in the test's directory. */
const longPath = (n: i32): string => {
  const parts: string[] = [DIR];
  for (let i = DIR.length; i < n; i++) {
    parts.push("p");
  }
  return parts.join("");
};

/** A stream pair, handed to `use` and closed after: its answer, or the pair's failure. */
const withPair = (kind: i32, use: (a: i32, b: i32) => i32): i32 => {
  const fds: i32[] = [-1, -1];
  const made = unixSocketPair(kind, fds);
  if (made !== 0) {
    return made;
  }
  const answer = use(fds[0], fds[1]);
  netClose(fds[0]);
  netClose(fds[1]);
  return answer;
};

/** A listener at `CYCLE`, a connect, its accept and one byte each way, all closed again: 0, or the first failure. */
const cycle = (): i32 => {
  const listener = unixListen(CYCLE, 4, 0);
  if (listener < 0) {
    return listener;
  }
  const client = unixConnect(CYCLE);
  const served = client >= 0 ? unixAccept(listener) : client;
  const buf: u8[] = [0];
  let answer = served < 0 ? served : 0;
  if (answer === 0 && (netWrite(client, byte(), 0, 1) !== 1 || netRead(served, buf, 0, 1) !== 1)) {
    answer = -1;
  }
  if (answer === 0 && (netWrite(served, byte(), 0, 1) !== 1 || netRead(client, buf, 0, 1) !== 1)) {
    answer = -1;
  }
  if (served >= 0) {
    netClose(served);
  }
  if (client >= 0) {
    netClose(client);
  }
  netClose(listener);
  unlinkSync(CYCLE);
  return answer;
};

/** An accept on a listener nobody has connected to: its answer, -11. */
const idle = (): i32 => {
  const listener = unixListen(IDLE, 4, 0);
  if (listener < 0) {
    return listener;
  }
  const answer = unixAccept(listener);
  netClose(listener);
  unlinkSync(IDLE);
  return answer;
};

/** One end of a pair sends its other end over the pair; the copy that comes back is closed: 0, or the failure. */
const passed = (): i32 =>
  withPair(NET_UNIX_STREAM, (a: i32, b: i32): i32 => {
    const sent = sendFd(a, b, byte(), 0, 1);
    if (sent !== 1) {
      return sent < 0 ? sent : -1;
    }
    const buf: u8[] = [0];
    const fd: i32[] = [-1];
    const got = recvFd(b, buf, 0, 1, fd);
    if (fd[0] >= 0) {
      netClose(fd[0]);
    }
    return got === 1 && fd[0] >= 0 ? 0 : -1;
  });

/** The number of calls `attempt` makes. */
const ATTEMPTS: i32 = 29;

/** The `k`th call's answer, `live` the listener `main` keeps open. */
const attempt = (k: i32, live: i32): i32 => {
  if (k === 0) {
    return unixListen(LIVE, 4, 0);
  }
  if (k === 1) {
    return unixListen(LIVE, 4, NET_UNIX_UNLINK_STALE);
  }
  if (k === 2) {
    return unixListen(DEAD, 4, 0);
  }
  if (k === 3) {
    return unixListen(FILE, 4, NET_UNIX_UNLINK_STALE);
  }
  if (k === 4) {
    return unixConnect(DEAD);
  }
  if (k === 5) {
    return unixConnect("build/test/net-unix-proc-fds/missing.sock");
  }
  if (k === 6) {
    return unixListen("@nish-net-unix-proc-fds\x00", 4, 0);
  }
  if (k === 7) {
    return unixListenMode("build/test/net-unix-proc-fds/mode.sock", 4, 0, 0o1000);
  }
  if (k === 8) {
    return unixListen("build/test/net-unix-proc-fds/nowhere/x.sock", 4, 0);
  }
  if (k === 9) {
    return unixSocketPair(3, [-1, -1]);
  }
  if (k === 10) {
    return unixSocketPair(NET_UNIX_STREAM, [-1]);
  }
  if (k === 11) {
    return unixListen(longPath(108), 4, 0);
  }
  if (k === 12) {
    return unixConnect(longPath(108));
  }
  if (k === 13) {
    return unixListen("", 4, 0);
  }
  if (k === 14) {
    return unixListen("build/test/net-unix-proc-fds/flags.sock", 4, 2);
  }
  if (k === 15) {
    return unixListenMode("@nish-net-unix-proc-fds", 4, 0, 0o600);
  }
  if (k === 16) {
    return unixAccept(1000);
  }
  if (k === 17) {
    return idle();
  }
  if (k === 18) {
    return sendFd(1000, 0, byte(), 0, 1);
  }
  if (k === 19) {
    return withPair(NET_UNIX_STREAM, (a: i32, b: i32): i32 => sendFd(a, -1, byte(), 0, 1));
  }
  if (k === 20) {
    return withPair(NET_UNIX_STREAM, (a: i32, b: i32): i32 => sendFd(a, 1000, byte(), 0, 1));
  }
  if (k === 21) {
    return recvFd(1000, [0], 0, 1, [-1]);
  }
  if (k === 22) {
    return withPair(NET_UNIX_STREAM, (a: i32, b: i32): i32 => recvFd(b, [0], 0, 1, [-1]));
  }
  if (k === 23) {
    return peerCredentials(1000, [0, 0, 0]);
  }
  if (k === 24) {
    return peerCredentials(live, [0, 0, 0]);
  }
  if (k === 25) {
    return withPair(NET_UNIX_SEQPACKET, (a: i32, b: i32): i32 => peerCredentials(a, [0, 0, 0]));
  }
  if (k === 26) {
    return cycle();
  }
  if (k === 27) {
    return passed();
  }
  const fd = unixListen(DEAD, 4, NET_UNIX_UNLINK_STALE);
  if (fd >= 0) {
    netClose(fd);
  }
  return fd < 0 ? fd : 0;
};

export const main = (): i32 => {
  mkdirSync(DIR);
  unlinkSync(LIVE);
  unlinkSync(DEAD);
  unlinkSync(CYCLE);
  unlinkSync(IDLE);
  writeFileSync(FILE, "keep");
  const start = openFds();
  console.log(`counted ${start > 0}`);
  const live = unixListen(LIVE, 4, 0);
  const dead = unixListen(DEAD, 4, 0);
  netClose(dead);
  console.log(`setUp ${live >= 0 && dead >= 0}`);
  for (let k = 0; k < ATTEMPTS; k++) {
    const before = openFds();
    const answer = attempt(k, live);
    const change = openFds() - before;
    console.log(`attempt ${k}: ${answer}, descriptors ${change >= 0 ? "+" : ""}${change}`);
  }
  netClose(live);
  unlinkSync(LIVE);
  unlinkSync(DEAD);
  unlinkSync(FILE);
  const change = openFds() - start;
  console.log(`tearDown, descriptors ${change >= 0 ? "+" : ""}${change}`);
  return 0;
};

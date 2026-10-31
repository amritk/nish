// `spawnWithFds(argv, fds)` hands the child `fds[i]` as descriptor `3 + i`.
// `spawn_fds_child.c` runs this program three ways. Run plain, it puts the files
// holding "a", "b" and "c" on descriptors 3, 4 and 5 and calls `attempt`, which
// starts the program again as "child" through `spawnWithFds`; that child
// prints every descriptor from 3 up it holds, as the letter it reads there (or
// "-" for a socket) and a mark for each flag set, so the line shows exactly
// which descriptors arrived, holding what. The attempts cover a source already
// on its own target (3 to 3), sources on each other's targets ([5, 3, 4]), one
// source twice, none, 64, a non-blocking socket, and every refusal: 65
// descriptors, a negative one, one that is not open, an empty argv and a
// program that is not there. The driver counts this process's descriptors
// around each attempt, and the change must be 0. Then `pass` runs the program
// as "pass" holding one end of a stream pair, and sends it the "a" file over
// that end with `sendFd`: the child takes it with `recvFd`, reads it, checks
// `peerCredentials` names this process, and starts a "child" of its own with
// `spawn`, which must see no descriptor from 3 up, the received one included.
import { recvFd, NET_UNIX_STREAM, netClose, peerCredentials, sendFd, unixSocketPair } from "nish:net";

/** Run `argv` with `fds` and wait for it: its status, or the refusal. */
const run = (argv: string[], fds: readonly i32[]): i32 => {
  const pid = spawnWithFds(argv, fds);
  return pid < 0 ? pid : waitPid(pid, 0)[1];
};

/** This program as `mode`: the driver puts its own path in `SPAWN_FDS_SELF`. */
const self = (mode: string): string[] => {
  const path = getenv("SPAWN_FDS_SELF");
  return [path === null ? "" : path, mode];
};

/** The number of calls `attempt` makes. */
export const attempts = (): i32 => 12;

/** The `k`th call's answer. */
export const attempt = (k: i32): i32 => {
  if (k === 0) {
    return run(self("child"), [3, 4, 5]);
  }
  if (k === 1) {
    return run(self("child"), [5, 3, 4]);
  }
  if (k === 2) {
    return run(self("child"), [4, 4]);
  }
  if (k === 3) {
    return run(self("child"), []);
  }
  if (k === 4 || k === 5) {
    const fds: i32[] = new Array<i32>(k === 4 ? 64 : 65);
    for (let i = 0; i < fds.length; i++) {
      fds[i] = 3 + (i % 3);
    }
    return run(self("child"), fds);
  }
  if (k === 6) {
    const pair: i32[] = new Array<i32>(2);
    const made = unixSocketPair(NET_UNIX_STREAM, pair);
    const answer = made < 0 ? made : run(self("child"), [pair[1]]);
    netClose(pair[0]);
    netClose(pair[1]);
    return answer;
  }
  if (k === 7) {
    return run(self("child"), [3, -1]);
  }
  if (k === 8) {
    return run(self("child"), [3, 1000]);
  }
  if (k === 9) {
    return run([], [3]);
  }
  if (k === 10) {
    return run(["build/test/sfd-not-a-program"], [3]);
  }
  return run(self("child"), [-5]);
};

/** Run this program as "pass" with one end of a stream pair, and send it `file` over the other: the child's status. */
export const pass = (file: i32): i32 => {
  const pair: i32[] = new Array<i32>(2);
  const made = unixSocketPair(NET_UNIX_STREAM, pair);
  if (made < 0) {
    return made;
  }
  const pid = spawnWithFds(self("pass"), [pair[1]]);
  netClose(pair[1]);
  const sent = pid < 0 ? pid : sendFd(pair[0], file, [33], 0, 1);
  const status = pid < 0 ? pid : waitPid(pid, 0)[1];
  netClose(pair[0]);
  return sent < 0 ? sent : status;
};

/** In the "pass" child: the descriptor that came over `sock`, or the failure. */
export const take = (sock: i32): i32 => {
  const buf: u8[] = new Array<u8>(8);
  const fd: i32[] = [0];
  const n = recvFd(sock, buf, 0, 8, fd);
  return n === 1 && buf[0] === 33 ? fd[0] : n < 0 ? n : -1000;
};

/** In the "pass" child: field `k` of `sock`'s peer, pid, uid or gid, or the failure. */
export const peer = (sock: i32, k: i32): i32 => {
  const out: i32[] = [0, 0, 0];
  const answer = peerCredentials(sock, out);
  return answer < 0 ? answer : out[k];
};

/** In the "pass" child: start a "child" with `spawn`, which hands it nothing, and wait for it. */
export const report = (): i32 => {
  const pid = spawn(self("child"));
  return pid < 0 ? pid : waitPid(pid, 0)[1];
};

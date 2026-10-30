// No Unix-domain call leaves a descriptor or a file behind (RT-35): not the
// socket a bind or a connect failed on, not the one the stale-socket probe
// made, and not the socket and file of a bind whose chmod failed after it.
// `net_unix_fds.c` counts the open descriptors around each call `attempt`
// makes, with a live listener and a dead socket file set up beforehand and
// taken down after, and prints the answer and the change. Each refusal in
// `nish_unix_addr`, `nish_unix_bound`, `nish_unix_socket_pair` and
// `unixAccept` has an attempt, and so do the calls that succeed, which close
// what they made before they answer, so their change is 0 as well. The
// driver's `chmod` fails for `nuf-chmodfail.sock`, and once every attempt has
// run it reports which of the paths the attempts named are still on disk.
// `hold` then makes one descriptor of each kind, a listener, a connect, its
// accept and each end of a stream pair, which the driver keeps open to read
// their flags: each is close-on-exec and non-blocking from creation.
import {
  NET_UNIX_STREAM,
  NET_UNIX_UNLINK_STALE,
  netClose,
  unixAccept,
  unixConnect,
  unixListen,
  unixListenMode,
  unixSocketPair,
} from "nish:net";
import { unlinkSync, writeFileSync } from "nish:fs";

const DIR: string = "build/test/";
const LIVE: string = "build/test/nuf-live.sock";
const DEAD: string = "build/test/nuf-dead.sock";
const FILE: string = "build/test/nuf-file.sock";
const CYCLE: string = "build/test/nuf-cycle.sock";
const IDLE: string = "build/test/nuf-idle.sock";
const HELD: string = "build/test/nuf-held.sock";

/** A path of exactly `n` bytes in the test's directory. */
const longPath = (n: i32): string => {
  const parts: string[] = [DIR];
  for (let i = DIR.length; i < n; i++) {
    parts.push("p");
  }
  return parts.join("");
};

/** The live listener, kept open by the driver, after the dead socket file and the regular file the attempts meet. */
export const setUp = (): i32 => {
  unlinkSync(LIVE);
  unlinkSync(DEAD);
  unlinkSync(CYCLE);
  unlinkSync(IDLE);
  unlinkSync(longPath(107));
  writeFileSync(FILE, "keep");
  const live = unixListen(LIVE, 4, 0);
  const dead = unixListen(DEAD, 4, 0);
  netClose(dead);
  return dead >= 0 ? live : -1;
};

/** A listener at `CYCLE`, a connect to it and the accept of that connect, all closed again: 0, or the first failure. */
const cycle = (): i32 => {
  const listener = unixListen(CYCLE, 4, 0);
  if (listener < 0) {
    return listener;
  }
  const client = unixConnect(CYCLE);
  const served = client >= 0 ? unixAccept(listener) : client;
  if (served >= 0) {
    netClose(served);
  }
  if (client >= 0) {
    netClose(client);
  }
  netClose(listener);
  unlinkSync(CYCLE);
  return served >= 0 ? 0 : served;
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

/** A stream pair, both ends closed: 0, or the failure. */
const pair = (): i32 => {
  const fds: i32[] = new Array<i32>(2);
  const answer = unixSocketPair(NET_UNIX_STREAM, fds);
  if (answer === 0) {
    netClose(fds[0]);
    netClose(fds[1]);
  }
  return answer;
};

/** The dead socket file cleared and bound again, then closed: 0, or the failure. */
const rebind = (): i32 => {
  const fd = unixListen(DEAD, 4, NET_UNIX_UNLINK_STALE);
  if (fd < 0) {
    return fd;
  }
  netClose(fd);
  return 0;
};

/** The number of calls `attempt` makes. */
export const attempts = (): i32 => 23;

/** The `k`th call's answer. */
export const attempt = (k: i32): i32 => {
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
    return unixConnect("build/test/nuf-missing.sock");
  }
  if (k === 6) {
    return unixListen("@nish-net-unix-fds\x00", 4, 0);
  }
  if (k === 7) {
    return unixListenMode("build/test/nuf-mode.sock", 4, 0, 0o1000);
  }
  if (k === 8) {
    return unixListen("build/test/nuf-nowhere/x.sock", 4, 0);
  }
  if (k === 9) {
    return unixSocketPair(3, new Array<i32>(2));
  }
  if (k === 10) {
    return unixSocketPair(NET_UNIX_STREAM, new Array<i32>(1));
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
    return unixListen("@", 4, 0);
  }
  if (k === 15) {
    return unixListen("build/test/nuf-flags.sock", 4, 2);
  }
  if (k === 16) {
    return unixListenMode("@nish-net-unix-fds", 4, 0, 0o600);
  }
  if (k === 17) {
    return unixListenMode("build/test/nuf-chmodfail.sock", 4, 0, 0o600);
  }
  if (k === 18) {
    return unixAccept(1000);
  }
  if (k === 19) {
    return idle();
  }
  if (k === 20) {
    return cycle();
  }
  if (k === 21) {
    return pair();
  }
  return rebind();
};

/** The `k`th descriptor the driver keeps to read its flags: a listener at `HELD`, a connect to it, the accept of that connect on `listener`, then end 0 and end 1 of a stream pair, the other end closed. */
export const hold = (k: i32, listener: i32): i32 => {
  if (k === 0) {
    unlinkSync(HELD);
    return unixListen(HELD, 4, 0);
  }
  if (k === 1) {
    return unixConnect(HELD);
  }
  if (k === 2) {
    return unixAccept(listener);
  }
  const fds: i32[] = new Array<i32>(2);
  const answer = unixSocketPair(NET_UNIX_STREAM, fds);
  if (answer < 0) {
    return answer;
  }
  netClose(fds[4 - k]);
  return fds[k - 3];
};

/** Remove the socket file `hold` made. */
export const release = (): i32 => unlinkSync(HELD);

/** Close the live listener and remove the files `setUp` made. */
export const tearDown = (live: i32): i32 => {
  netClose(live);
  unlinkSync(LIVE);
  unlinkSync(DEAD);
  return unlinkSync(FILE);
};

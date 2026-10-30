// Every refused Unix-domain call closes what it opened (RT-35): the socket a
// bind or a connect failed on, and the one the stale-socket probe made.
// `net_unix_fds.c` counts the open descriptors in `/proc/self/fd` around each
// call `attempt` makes, with a live listener and a dead socket file set up
// beforehand and taken down after, and prints the answer and the change.
import { NET_UNIX_UNLINK_STALE, netClose, unixConnect, unixListen, unixListenMode, unixSocketPair } from "nish:net";
import { unlinkSync, writeFileSync } from "nish:fs";

const LIVE: string = "build/test/nuf-live.sock";
const DEAD: string = "build/test/nuf-dead.sock";
const FILE: string = "build/test/nuf-file.sock";

/** The live listener, kept open by the driver, after the dead socket file and the regular file the attempts meet. */
export const setUp = (): i32 => {
  unlinkSync(LIVE);
  unlinkSync(DEAD);
  writeFileSync(FILE, "keep");
  const live = unixListen(LIVE, 4, 0);
  const dead = unixListen(DEAD, 4, 0);
  netClose(dead);
  return dead >= 0 ? live : -1;
};

/** The `k`th refused call's answer. */
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
  return unixSocketPair(3, new Array<i32>(2));
};

/** Close the live listener and remove the files `setUp` made. */
export const tearDown = (live: i32): i32 => {
  netClose(live);
  unlinkSync(LIVE);
  unlinkSync(DEAD);
  return unlinkSync(FILE);
};

// The filesystem side of `nish:net`'s Unix-domain listeners, in a directory
// of the test's own (`build/test`). `unixListen` leaves the socket file at
// 0600 even under umask 0, `unixListenMode` at the mode it is given; a
// connection reaches either. A listener's file outlives its descriptor, and
// the next `unixListen` on it is -98 until it says `NET_UNIX_UNLINK_STALE`:
// then a file nobody listens on is removed and bound again, a live listener's
// is still -98, and a regular file is -17 and left where it was. A path past
// `sun_path` is -36 before anything touches the disk, so no file cut short
// to 107 bytes appears, a connect to a missing path -2 and one to a dead
// socket -111. `net_unix_paths.c` runs it under umask 0, reads each file's
// mode, size and presence back with `lstat`, and counts the chmods that found
// the socket already listening, which must be none (RT-34).
import { NET_UNIX_UNLINK_STALE, netClose, unixConnect, unixListen, unixListenMode } from "nish:net";
import { unlinkSync, writeFileSync } from "nish:fs";

declare function modeOf(path: string): i32;
declare function sizeOf(path: string): i32;
declare function listenedFirst(): i32;

const DIR: string = "build/test/";

/** `name` in the test's directory, with whatever an earlier run left there removed. */
const fresh = (name: string): string => {
  const path = DIR + name;
  unlinkSync(path);
  return path;
};

/** A path of exactly `n` bytes in the test's directory. */
const longPath = (n: i32): string => {
  const parts: string[] = [DIR];
  for (let i = DIR.length; i < n; i++) {
    parts.push("p");
  }
  return parts.join("");
};

export const run = (): i32 => {
  const plain = fresh("nup-plain.sock");
  const listener = unixListen(plain, 4, 0);
  console.log(`listen ${listener >= 0} mode ${modeOf(plain)}`);
  const client = unixConnect(plain);
  console.log(`connect ${client >= 0}`);
  console.log(`live default ${unixListen(plain, 4, 0)}`);
  console.log(`live stale ${unixListen(plain, 4, NET_UNIX_UNLINK_STALE)}`);
  netClose(client);
  netClose(listener);
  console.log(`after close mode ${modeOf(plain)}`);
  console.log(`dead connect ${unixConnect(plain)}`);
  console.log(`dead default ${unixListen(plain, 4, 0)}`);
  const again = unixListen(plain, 4, NET_UNIX_UNLINK_STALE);
  console.log(`dead stale ${again >= 0} mode ${modeOf(plain)}`);
  netClose(again);
  unlinkSync(plain);

  const shared = fresh("nup-shared.sock");
  const group = unixListenMode(shared, 4, 0, 0o660);
  console.log(`mode 0660 ${group >= 0} mode ${modeOf(shared)}`);
  const peer = unixConnect(shared);
  console.log(`connect ${peer >= 0}`);
  netClose(peer);
  netClose(group);
  unlinkSync(shared);

  const regular = fresh("nup-regular.sock");
  writeFileSync(regular, "keep");
  console.log(`regular stale ${unixListen(regular, 4, NET_UNIX_UNLINK_STALE)} size ${sizeOf(regular)}`);
  unlinkSync(regular);

  const missing = fresh("nup-missing.sock");
  console.log(`missing connect ${unixConnect(missing)}`);
  const fits = longPath(107);
  unlinkSync(fits);
  const edge = unixListen(fits, 4, 0);
  console.log(`107 bytes ${edge >= 0} mode ${modeOf(fits)}`);
  netClose(edge);
  unlinkSync(fits);
  const long = longPath(108);
  console.log(`108 bytes ${unixListen(long, 4, 0)} mode ${modeOf(long)}`);
  console.log(`108 bytes ${unixListenMode(long, 4, 0, 0o600)} mode ${modeOf(long)}`);
  console.log(`107 bytes after ${modeOf(fits)}`);
  console.log(`chmod after listen ${listenedFirst()}`);
  return 0;
};

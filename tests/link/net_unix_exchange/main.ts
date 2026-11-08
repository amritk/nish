// Two processes exchange bytes over a Unix-domain socket (#1129, criterion 1).
// The parent listens on a socket file in its own build directory and starts
// this program again as the child, naming the file. The child connects with
// `unixConnect`, writes "ping" and waits for the answer; the parent takes the
// connection with `unixAccept`, reads the four bytes, answers "pong" and reaps
// the child. The child prints nothing, since its buffered stdout would land
// before the parent's: what it read is its exit code, 0 for "pong" and the
// step that failed otherwise, which the parent prints after `waitPid`.
import { netClose, netWrite, unixAccept, unixConnect, unixListen } from "nish:net";
import { unlinkSync } from "nish:fs";
import { platform, spawn, waitPid } from "nish:process";
import { ping, pong, readAll, readable, same } from "./wire";

const PATH: string = "build/test/link/net_unix_exchange/exchange.sock";

/** This program's path, for running it again. */
const selfPath = (): string => {
  const exe: string | null = platform === "linux" ? realpathSync("/proc/self/exe") : null;
  return exe !== null ? exe : process.argv[0];
};

/** The child: connect to `path`, write "ping", read the answer. 0 for "pong", else the step that failed. */
const child = (path: string): i32 => {
  const fd = unixConnect(path);
  if (fd < 0) {
    return 10;
  }
  if (netWrite(fd, ping(), 0, 4) !== 4) {
    netClose(fd);
    return 11;
  }
  const buf = new Array<u8>(4);
  const got = readAll(fd, buf);
  netClose(fd);
  if (got !== buf.length) {
    return 12;
  }
  return same(buf, pong()) ? 0 : 13;
};

export const main = (): i32 => {
  if (process.argv.length > 2 && process.argv[1] === "child") {
    return child(process.argv[2]);
  }
  unlinkSync(PATH);
  const listener = unixListen(PATH, 4, 0);
  console.log(`listen ${listener >= 0}`);
  if (listener < 0) {
    return 1;
  }
  const pid = spawn([selfPath(), "child", PATH]);
  console.log(`spawn ${pid > 0}`);
  if (pid <= 0) {
    netClose(listener);
    unlinkSync(PATH);
    return 1;
  }
  const conn = readable(listener) ? unixAccept(listener) : -11;
  console.log(`accept ${conn >= 0}`);
  if (conn >= 0) {
    const buf = new Array<u8>(4);
    const got = readAll(conn, buf);
    console.log(`parent read ${got}: ${String.fromBytes(buf, 0, got)}`);
    console.log(`parent write ${netWrite(conn, pong(), 0, 4)}`);
    netClose(conn);
  }
  const reaped = waitPid(pid, 0);
  console.log(`child exit ${reaped[0] === pid ? reaped[1] : -1}`);
  netClose(listener);
  console.log(`unlink ${unlinkSync(PATH)}`);
  return 0;
};

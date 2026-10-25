// `PreforkConfig.restart` off, end to end. With no arguments this program is
// the driver; it runs itself again as a supervisor (`exit <port> <pid>` or
// `hold <port> <pid>`, the pid its own), and each supervisor runs it once
// more per worker. Every worker sends "s <index> <pid>" to the driver's UDP
// port when it starts. The driver checks:
//
//   1. with two workers that exit at once, each starts exactly once, and the
//      supervisor then exits by itself, 0 (`preforkWith` answered
//      `PREFORK_WORKERS_EXITED`), with no signal from the driver;
//   2. with two workers that run until stopped, a worker killed with SIGKILL
//      is not started again, the supervisor keeps running with the other, and
//      SIGTERM still stops it and exits 0 (`PREFORK_STOPPED`).
//
// Every wait is bounded. A worker that finds the driver gone exits, so no
// process outlives a driver the harness killed by more than a second.
import { netAddress, netClose, netLocalPort, pollAdd, pollCreate, pollWait, udpBind, udpRecvFrom, udpSendTo } from "nish:net";
import { kill, platform, spawn, waitPid } from "nish:process";
import { PREFORK_STOPPED, PREFORK_WORKERS_EXITED, PreforkConfig, preforkArgs, preforkWith } from "nish/net/prefork";

/** This process's pid on Linux, from `/proc/self`; 0 elsewhere. */
const selfPid = (): i32 => {
  const self = realpathSync("/proc/self");
  return self !== null ? parseInt(self.substring(6)) : 0;
};

/** This program's path, for running it again. */
const selfPath = (): string => {
  const exe: string | null = platform === "linux" ? realpathSync("/proc/self/exe") : null;
  return exe !== null ? exe : process.argv[0];
};

/** Sleep `ms` milliseconds on an empty poll loop. */
const pause = (ms: i32): void => {
  const loop = pollCreate();
  const ready: i32[] = new Array<i32>(2);
  pollWait(loop, ready, ms);
  netClose(loop);
};

/** `kill(pid, sig)` succeeded; false without a call for a pid that is not positive. */
const signal = (pid: i32, sig: i32): boolean => pid > 0 && kill(pid, sig) === 0;

/** Send `text` to the driver's UDP `port`. */
const tell = (port: i32, text: string): void => {
  const fd = udpBind("127.0.0.1", 0, 0);
  const to: u8[] = new Array<u8>(18);
  netAddress(to, "127.0.0.1", port);
  const out: u8[] = new Array<u8>(32);
  let n: i32 = 0;
  for (; n < text.length && n < 32; n++) {
    out[n] = toU8(text.charCodeAt(n));
  }
  udpSendTo(fd, out, 0, n, to, 0, 0);
  netClose(fd);
};

/** The supervisor, or a worker: whichever `preforkWith` says this process is. */
const supervise = (mode: string, port: i32, driver: i32): number => {
  const config = new PreforkConfig();
  config.workers = 2;
  config.tickMs = 10;
  config.graceMs = 2000;
  config.restart = false;
  const worker = preforkWith(process.argv, config);
  if (worker < 0) {
    // The supervisor says which way it stopped in its exit status.
    if (worker === PREFORK_WORKERS_EXITED) {
      return 0;
    }
    return worker === PREFORK_STOPPED ? 0 : 1;
  }
  tell(port, `s ${worker} ${selfPid()}`);
  if (mode === "exit") {
    return 3;
  }
  for (let k: i32 = 0; k < 200 && signal(driver, 0); k++) {
    pause(50);
  }
  return 0;
};

/**
 * True when child `pid` exits 0 within `ms`, without a blocking wait; past the
 * deadline it gets SIGKILL and a second at most to be reaped.
 */
const exitsZero = (pid: i32, ms: i32): boolean => {
  if (pid <= 0) {
    return false;
  }
  for (let k: i32 = 0; k < ms / 10 + 100; k++) {
    const status = waitPid(pid, 1);
    if (status[0] !== 0) {
      return status[0] === pid && status[1] === 0 && k < ms / 10;
    }
    if (k === ms / 10) {
      console.log(`child ${pid} still running after ${ms} ms`);
      signal(pid, 9);
    }
    pause(10);
  }
  return false;
};

/** Collect every start message for `ms`: "<index> <pid>" per start. */
const starts = (fd: i32, ms: i32, into: string[]): void => {
  const loop = pollCreate();
  pollAdd(loop, fd, 1, 0);
  const ready: i32[] = new Array<i32>(2);
  const buf: u8[] = new Array<u8>(32);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = new Array<i32>(2);
  while (pollWait(loop, ready, ms) > 0) {
    let n = udpRecvFrom(fd, buf, 0, 32, from, meta);
    while (n > 0) {
      into.push(String.fromBytes(buf, 2, n));
      n = udpRecvFrom(fd, buf, 0, 32, from, meta);
    }
  }
  netClose(loop);
};

/** Step 1: workers that exit at once, and a supervisor that follows them. */
const exits = (): void => {
  const fd = udpBind("127.0.0.1", 0, 0);
  const sup = spawn([selfPath(), "exit", `${netLocalPort(fd)}`, `${selfPid()}`]);
  const seen: string[] = [];
  starts(fd, 1000, seen);
  console.log(seen.length === 2);
  console.log(exitsZero(sup, 5000));
  netClose(fd);
};

/** Step 2: a killed worker stays dead, and SIGTERM still stops the rest. */
const holds = (): void => {
  const fd = udpBind("127.0.0.1", 0, 0);
  const sup = spawn([selfPath(), "hold", `${netLocalPort(fd)}`, `${selfPid()}`]);
  const seen: string[] = [];
  starts(fd, 1000, seen);
  console.log(seen.length === 2);
  const victim: i32 = seen.length > 0 ? parseInt(seen[0].substring(seen[0].indexOf(" ") + 1)) : 0;
  console.log(signal(victim, 9));
  starts(fd, 500, seen);
  console.log(seen.length === 2);
  console.log(signal(sup, 0));
  console.log(signal(sup, 15));
  console.log(exitsZero(sup, 5000));
  netClose(fd);
};

export const main = (): number => {
  const args = preforkArgs(process.argv);
  if (args.length > 3) {
    return supervise(args[1], parseInt(args[2]), parseInt(args[3]));
  }
  exits();
  holds();
  return 0;
};

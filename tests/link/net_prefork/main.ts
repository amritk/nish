// `nish/net/prefork` end to end. With no arguments this program is the driver;
// it runs itself again as a supervisor (`serve <port> <pid>`, `crash <port>
// <pid>`, the pid its own), and each supervisor runs it once more per worker,
// `preforkWith` telling the two apart. The driver checks, in order:
//
//   1. the helpers: `NISH_WORKERS` beats the config only when it is a positive
//      whole number, and the worker flag is read only as the last argument;
//   2. three workers share one SO_REUSEPORT port and the kernel spreads 48
//      connections across at least two of them (Linux; elsewhere one serves);
//   3. a worker's arena is where it stood after each of its answers;
//   4. a worker killed with SIGKILL is started again at its index, a new pid;
//   5. SIGTERM to the supervisor stops every worker and the supervisor exits 0,
//      after which the port refuses a connection;
//   6. a worker that dies young waits before its restart, twice as long each
//      time up to the cap: each crash worker sends its start time on the
//      system-wide monotonic clock, so the gaps have exact lower bounds.
//
// Every wait is bounded. The driver passes its pid to each supervisor, which
// adds its own; a worker that finds the driver gone (the harness killed it, or
// it failed) sends the supervisor SIGTERM, so no supervisor outlives its driver
// by more than a second restarting workers nobody reads.
import {
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollModify,
  pollWait,
  tcpAccept,
  tcpConnect,
  tcpListenFlags,
  udpBind,
  udpRecvFrom,
  udpSendTo,
} from "nish:net";
import { getenv, kill, monotonicNanos, platform, spawn, waitPid } from "nish:process";
import { PreforkConfig, preforkArgs, preforkIndex, preforkWith, preforkWorkerCount } from "nish/net/prefork";

const WOULD_BLOCK: i32 = -11;
const REFUSED: i32 = -111;
const BACKOFF_MS: i32 = 40;
const CAP_MS: i32 = 160;
const STARTS: i32 = 6;

/** Three workers where the kernel spreads a shared port, one elsewhere. */
const workers = (): i32 => (platform === "linux" ? 3 : 1);

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

/** `text`'s bytes into `out`; answers how many. */
const ascii = (text: string, out: u8[]): i32 => {
  for (let i: i32 = 0; i < text.length && i < out.length; i++) {
    out[i] = toU8(text.charCodeAt(i));
  }
  return toI32(text.length);
};

/**
 * True when the driver whose pid `args[3]` carries is gone, after sending the
 * supervisor (`args[4]`) SIGTERM. Off Linux, where `selfPid` is 0, never.
 */
const orphaned = (args: string[]): boolean => {
  const driver: i32 = args.length > 4 ? parseInt(args[3]) : 0;
  if (driver <= 0 || kill(driver, 0) === 0) {
    return false;
  }
  kill(parseInt(args[4]), 15);
  return true;
};

/** A worker of `serve`: answer each connection with `index pid arena` and close it. */
const serveWorker = (index: i32, port: i32, args: string[]): number => {
  const fd = tcpListenFlags("127.0.0.1", port, 64, 1);
  if (fd < 0) {
    return 3;
  }
  const pid = selfPid();
  const loop = pollCreate();
  pollAdd(loop, fd, 1, 0);
  const ready: i32[] = new Array<i32>(2);
  const peer: u8[] = new Array<u8>(18);
  const out: u8[] = new Array<u8>(64);
  let idle: i32 = 0;
  while (idle < 20 && !orphaned(args)) {
    idle = pollWait(loop, ready, 1000) > 0 ? 0 : idle + 1;
    let conn = tcpAccept(fd, peer);
    while (conn >= 0) {
      const n = ascii(`${index} ${pid} ${Arena.used()}\n`, out);
      netWrite(conn, out, 0, n);
      netClose(conn);
      conn = tcpAccept(fd, peer);
    }
  }
  return 0;
};

/** A worker of `crash`: send its start time to the driver's UDP port, then fail. */
const crashWorker = (port: i32, args: string[]): number => {
  if (orphaned(args)) {
    return 0;
  }
  const fd = udpBind("127.0.0.1", 0, 0);
  const to: u8[] = new Array<u8>(18);
  netAddress(to, "127.0.0.1", port);
  const out: u8[] = new Array<u8>(32);
  const n = ascii(`${monotonicNanos()}`, out);
  udpSendTo(fd, out, 0, n, to, 0, 0);
  return 7;
};

/**
 * The supervisor, or a worker: whichever `preforkWith` says this process is.
 * The supervisor appends its pid to the arguments its workers get.
 */
const supervise = (mode: string, port: i32): number => {
  const config = new PreforkConfig();
  config.tickMs = 10;
  config.graceMs = 2000;
  if (mode === "crash") {
    config.workers = 1;
    config.backoffMs = BACKOFF_MS;
    config.backoffCapMs = CAP_MS;
  } else {
    config.workers = workers();
  }
  const argv: string[] = preforkArgs(process.argv);
  if (preforkIndex(process.argv) < 0) {
    argv.push(`${selfPid()}`);
  } else {
    argv.push(process.argv[process.argv.length - 1]);
  }
  const worker = preforkWith(argv, config);
  if (worker < 0) {
    return worker === -1 ? 0 : 1;
  }
  const args = preforkArgs(argv);
  return mode === "crash" ? crashWorker(port, args) : serveWorker(worker, port, args);
};

/** One answer from the port's workers; "refused" when nothing listens, "" on a failure. */
const request = (port: i32): string => {
  const addr: u8[] = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", port);
  const fd = tcpConnect(addr);
  const loop = pollCreate();
  pollAdd(loop, fd, 2, 0);
  const ready: i32[] = new Array<i32>(2);
  let result = "";
  if (pollWait(loop, ready, 2000) > 0) {
    const made = connectResult(fd);
    if (made === REFUSED) {
      result = "refused";
    } else if (made === 0) {
      const buf: u8[] = new Array<u8>(64);
      let got: i32 = 0;
      let quiet = false;
      pollModify(loop, fd, 1, 0);
      while (!quiet) {
        const n = netRead(fd, buf, got, 64 - got);
        if (n > 0) {
          got = got + n;
        } else if (n === WOULD_BLOCK) {
          quiet = pollWait(loop, ready, 2000) <= 0;
        } else {
          break;
        }
      }
      result = got > 0 && !quiet ? String.fromBytes(buf, 0, got - 1) : "";
    }
  }
  netClose(fd);
  netClose(loop);
  return result;
};

/** Wait `ms` milliseconds. */
const pause = (ms: i32): void => {
  const loop = pollCreate();
  const ready: i32[] = new Array<i32>(2);
  pollWait(loop, ready, ms);
  netClose(loop);
};

/** The first answer, retrying while the workers bind; "" after 5 s. */
const firstAnswer = (port: i32): string => {
  for (let tries: i32 = 0; tries < 100; tries++) {
    const answer = request(port);
    if (answer !== "refused") {
      return answer;
    }
    pause(50);
  }
  return "";
};

/** The worker index, pid and arena of an answer. */
const field = (answer: string, at: i32): i32 => {
  const one = toI32(answer.indexOf(" "));
  const two = one < 0 ? -1 : toI32(answer.indexOf(" ", one + 1));
  if (two < 0) {
    return -1;
  }
  if (at === 0) {
    return parseInt(answer.substring(0, one));
  }
  return parseInt(at === 1 ? answer.substring(one + 1, two) : answer.substring(two + 1));
};

/** A port nobody holds now: bound, read and closed again. */
const freePort = (): i32 => {
  const fd = tcpListenFlags("127.0.0.1", 0, 1, 1);
  const port = netLocalPort(fd);
  netClose(fd);
  return port;
};

const helpers = (): void => {
  console.log(preforkWorkerCount(0, "2") === 2 && preforkWorkerCount(5, "3") === 3);
  console.log(preforkWorkerCount(4, "0") === 4 && preforkWorkerCount(4, "abc") === 4);
  console.log(preforkWorkerCount(4, "-3") === 4 && preforkWorkerCount(4, "2x") === 4 && preforkWorkerCount(4, null) === 4);
  console.log(preforkWorkerCount(0, null) >= 1);
  console.log(preforkIndex(["a", "--nish-prefork-worker=7"]) === 7 && preforkIndex(["a", "--nish-prefork-worker=12"]) === 12);
  console.log(preforkIndex(["a"]) === -1 && preforkIndex(["--nish-prefork-worker=1"]) === -1);
  console.log(preforkIndex(["a", "--nish-prefork-worker=1", "b"]) === -1 && preforkIndex(["a", "--nish-prefork-worker="]) === -1);
  console.log(preforkIndex(["a", "--nish-prefork-worker=-1"]) === -1 && preforkArgs(process.argv).length === process.argv.length);
};

/** Steps 2 to 5. */
const served = (): void => {
  const port = freePort();
  const sup = spawn([selfPath(), "serve", `${port}`, `${selfPid()}`]);
  const first = firstAnswer(port);
  console.log(sup > 0 && first !== "" && first !== "refused");

  // Spread, and each worker's arena across its answers.
  const pids: i32[] = new Array<i32>(workers());
  const arenas: i64[] = new Array<i64>(workers());
  const counts: i32[] = new Array<i32>(workers());
  let flat = true;
  for (let k: i32 = 0; k < 48; k++) {
    const answer = request(port);
    const index = field(answer, 0);
    if (index < 0 || index >= counts.length || index >= arenas.length || index >= pids.length) {
      flat = false;
    } else {
      const used: i64 = toI64(field(answer, 2));
      flat = flat && (counts[index] === 0 || arenas[index] === used);
      arenas[index] = used;
      pids[index] = field(answer, 1);
      counts[index] = counts[index] + 1;
    }
  }
  let answered: i32 = 0;
  for (const count of counts) {
    answered = answered + (count > 0 ? 1 : 0);
  }
  console.log(platform !== "linux" || answered >= 2);
  console.log(flat);

  // A killed worker comes back at its index with a new pid.
  let victim: i32 = 0;
  let old: i32 = 0;
  for (let i: i32 = counts.length - 1; i >= 0; i--) {
    if (i < pids.length && counts[i] > 0) {
      victim = i;
      old = pids[i];
    }
  }
  console.log(platform !== "linux" || kill(old, 9) === 0);
  let back = platform !== "linux";
  // It died young, so it waits out `backoffMs` first; five seconds at most.
  for (let k: i32 = 0; k < 500 && !back; k++) {
    const answer = request(port);
    back = field(answer, 0) === victim && field(answer, 1) !== old && field(answer, 1) > 0;
    if (!back) {
      pause(10);
    }
  }
  console.log(back);

  // SIGTERM stops it all.
  console.log(kill(sup, 15) === 0);
  const done = waitPid(sup, 0);
  console.log(done[0] === sup && done[1] === 0);
  console.log(request(port) === "refused");
};

/** Step 6: the gaps between the starts of a worker that keeps failing. */
const crashes = (): void => {
  const fd = udpBind("127.0.0.1", 0, 0);
  const port = netLocalPort(fd);
  const sup = spawn([selfPath(), "crash", `${port}`, `${selfPid()}`]);
  const loop = pollCreate();
  pollAdd(loop, fd, 1, 0);
  const ready: i32[] = new Array<i32>(2);
  const buf: u8[] = new Array<u8>(32);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = new Array<i32>(2);
  const starts: i64[] = [];
  while (starts.length < STARTS && pollWait(loop, ready, 3000) > 0) {
    let n = udpRecvFrom(fd, buf, 0, 32, from, meta);
    while (n > 0 && starts.length < STARTS) {
      starts.push(toI64(Number(String.fromBytes(buf, 0, n))));
      n = udpRecvFrom(fd, buf, 0, 32, from, meta);
    }
  }
  console.log(starts.length === STARTS);
  let wait: i64 = toI64(BACKOFF_MS);
  let ordered = true;
  for (let i: i32 = 1; i < starts.length; i++) {
    const gapMs: i64 = (starts[i] - starts[i - 1]) / 1000000;
    if (gapMs < wait) {
      console.log(`gap ${i}: ${gapMs} ms, wanted ${wait}`);
      ordered = false;
    }
    wait = wait * 2 < toI64(CAP_MS) ? wait * 2 : toI64(CAP_MS);
  }
  console.log(ordered);
  console.log(kill(sup, 15) === 0);
  const done = waitPid(sup, 0);
  console.log(done[0] === sup && done[1] === 0);
  netClose(fd);
};

export const main = (): number => {
  const args = preforkArgs(process.argv);
  if (args.length > 2) {
    return supervise(args[1], parseInt(args[2]));
  }
  console.log(getenv("NISH_WORKERS") === null);
  helpers();
  served();
  crashes();
  return 0;
};

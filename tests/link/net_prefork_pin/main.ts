// `nish/net/prefork`'s `pin` and supervisor-held listeners, end to end. With
// no arguments this program is the driver; it runs itself again as a
// supervisor (`serve <udp> <pid>`), which runs it once more per worker, and as
// a client (`client <port> <cpu>`). The driver checks, in order:
//
//   1. `setCpuAffinity` refuses a CPU below 0 or past the kernel's set with
//      -22 and no change (Linux), and is -95 on Darwin; `tcpListenFlags`
//      refuses steering (4) without `SO_REUSEPORT` (1) everywhere;
//   2. `preforkListener` reads the listener flag before the channels flag or
//      the worker flag and nowhere else, and `preforkArgs` strips it;
//   3. with `pin`, worker k's `Cpus_allowed_list` is exactly `k` (Linux), and
//      every worker serves the one port the supervisor bound for all of them
//      (port 0, so the first listener picks it);
//   4. (Linux) a client pinned to CPU k is answered by worker k: the loopback
//      SYN is handled on the client's CPU, and the steering program hands it
//      to listener k, which only worker k holds;
//   5. SIGTERM stops it all, and the port then refuses a connection: the
//      supervisor closed the listeners it held.
//
// Workers are min(2, CPUs), so a one-CPU runner still runs every step. Each
// wait is bounded, and a worker that finds the driver gone sends its
// supervisor SIGTERM, as in `tests/link/net_prefork`.
import {
  connectResult,
  netAddress,
  netClose,
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
  netLocalPort,
} from "nish:net";
import { availableParallelism, kill, platform, setCpuAffinity, spawn, waitPid } from "nish:process";
import { PreforkConfig, preforkArgs, preforkListener, preforkWith } from "nish/net/prefork";

const WOULD_BLOCK: i32 = -11;
const REFUSED: i32 = -111;

/** Two workers, or one on a one-CPU machine, so that `pin` never refuses. */
const workers = (): i32 => (availableParallelism() > 1 ? 2 : 1);

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

/** Wait `ms` milliseconds. */
const pause = (ms: i32): void => {
  const loop = pollCreate();
  const ready: i32[] = new Array<i32>(2);
  pollWait(loop, ready, ms);
  netClose(loop);
};

/** `kill(pid, sig)` succeeded; false without a call for a pid that is not positive. */
const signal = (pid: i32, sig: i32): boolean => pid > 0 && kill(pid, sig) === 0;

/**
 * True when this process's `Cpus_allowed_list` is exactly `cpus`, as a child
 * it starts reads it: the mask is inherited, and `/proc/self/status` reads as
 * empty through `readFileSync`, which sizes a file by its `stat`. Linux only.
 */
const allowedOn = (cpus: string): boolean =>
  spawnSync(["sh", "-c", `test "$(awk '/^Cpus_allowed_list:/ {print $2}' /proc/self/status)" = ${cpus}`]) === 0;

/**
 * True when the driver whose pid `args[3]` carries is gone, after sending the
 * supervisor (`args[4]`) SIGTERM. Off Linux, where `selfPid` is 0, never.
 */
const orphaned = (args: string[]): boolean => {
  const driver: i32 = args.length > 4 ? parseInt(args[3]) : 0;
  if (driver <= 0 || kill(driver, 0) === 0) {
    return false;
  }
  signal(parseInt(args[4]), 15);
  return true;
};

/** Send `text` to the driver's UDP `port`. */
const tell = (port: i32, text: string): void => {
  const fd = udpBind("127.0.0.1", 0, 0);
  const to: u8[] = new Array<u8>(18);
  netAddress(to, "127.0.0.1", port);
  const out: u8[] = new Array<u8>(64);
  const n = ascii(text, out);
  udpSendTo(fd, out, 0, n, to, 0, 0);
  netClose(fd);
};

/**
 * A worker: tell the driver `index pinned port`, then answer each connection on
 * the listener the supervisor handed it with its index and close it.
 */
const serveWorker = (index: i32, fd: i32, udp: i32, args: string[]): number => {
  tell(udp, `${index} ${platform !== "linux" || allowedOn(`${index}`)} ${fd >= 0 ? netLocalPort(fd) : fd}`);
  if (fd < 0) {
    return 3;
  }
  const loop = pollCreate();
  pollAdd(loop, fd, 1, 0);
  const ready: i32[] = new Array<i32>(2);
  const peer: u8[] = new Array<u8>(18);
  const out: u8[] = new Array<u8>(16);
  let idle: i32 = 0;
  while (idle < 20 && !orphaned(args)) {
    idle = pollWait(loop, ready, 1000) > 0 ? 0 : idle + 1;
    let conn = tcpAccept(fd, peer);
    while (conn >= 0) {
      const n = ascii(`${index}\n`, out);
      netWrite(conn, out, 0, n);
      netClose(conn);
      conn = tcpAccept(fd, peer);
    }
  }
  return 0;
};

/** The supervisor, or a worker: whichever `preforkWith` says this process is. */
const supervise = (udp: i32): number => {
  const config = new PreforkConfig();
  config.workers = workers();
  config.tickMs = 10;
  config.graceMs = 2000;
  config.pin = true;
  config.listenPort = 0;
  config.listenHost = "127.0.0.1";
  config.listenBacklog = 64;
  const listener = preforkListener(process.argv);
  const argv: string[] = preforkArgs(process.argv);
  const supervisor = listener < 0;
  argv.push(supervisor ? `${selfPid()}` : process.argv[process.argv.length - 1]);
  const worker = preforkWith(argv, config);
  if (worker < 0) {
    return worker === -1 ? 0 : 1;
  }
  return serveWorker(worker, listener, udp, preforkArgs(argv));
};

/** One answer from `port`: "refused" when nothing listens, "" on a failure. */
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
      const buf: u8[] = new Array<u8>(16);
      let got: i32 = 0;
      let quiet = false;
      pollModify(loop, fd, 1, 0);
      while (!quiet && got < 16) {
        const n = netRead(fd, buf, got, 16 - got);
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

/** A client: pin to `cpu`, connect, and exit 10 plus the index that answered. */
const client = (port: i32, cpu: i32): number => {
  if (setCpuAffinity(cpu) !== 0) {
    return 2;
  }
  const answer = request(port);
  return answer === "" || answer === "refused" ? 3 : 10 + parseInt(answer);
};

/**
 * Child `pid`'s exit code within `ms`, -1 when it did not exit: a WNOHANG
 * loop, never on a pid that is not positive, and SIGKILL past the deadline.
 */
const exitCode = (pid: i32, ms: i32): i32 => {
  if (pid <= 0) {
    return -1;
  }
  for (let k: i32 = 0; k < ms / 10 + 100; k++) {
    const status = waitPid(pid, 1);
    if (status[0] !== 0) {
      return status[0] === pid && k < ms / 10 ? status[1] : -1;
    }
    if (k === ms / 10) {
      console.log(`child ${pid} still running after ${ms} ms`);
      signal(pid, 9);
    }
    pause(10);
  }
  return -1;
};

/** Steps 1 and 2. */
const helpers = (): void => {
  const refused: i32 = platform === "linux" ? -22 : -95;
  const before = availableParallelism();
  console.log(setCpuAffinity(-1) === refused && setCpuAffinity(1 << 20) === refused);
  console.log(availableParallelism() === before);
  console.log(tcpListenFlags("127.0.0.1", 0, 1, 4) === -22 && tcpListenFlags("127.0.0.1", 0, 1, 8) === -22);
  const worker = "--nish-prefork-worker=1";
  console.log(preforkListener(["a", "--nish-prefork-listener=5", worker]) === 5);
  console.log(preforkListener(["a", "--nish-prefork-listener=6", "--nish-prefork-channels=3", worker]) === 6);
  console.log(preforkListener(["a", "--nish-prefork-listener=5"]) === -1 && preforkListener(["a", worker]) === -1);
  console.log(preforkListener(["a", "--nish-prefork-listener=x", worker]) === -1);
  console.log(preforkArgs(["a", "b", "--nish-prefork-listener=5", "--nish-prefork-channels=3", worker]).length === 2);
};

/** Steps 3 to 5. */
const served = (): void => {
  const udp = udpBind("127.0.0.1", 0, 0);
  const loop = pollCreate();
  pollAdd(loop, udp, 1, 0);
  const sup = spawn([selfPath(), "serve", `${netLocalPort(udp)}`, `${selfPid()}`]);
  const count = workers();
  const pins: string[] = [];
  for (let k: i32 = 0; k < count; k++) {
    pins.push("");
  }
  let port: i32 = 0;
  let samePort = true;
  let reports: i32 = 0;
  const buf: u8[] = new Array<u8>(64);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = new Array<i32>(2);
  const ready: i32[] = new Array<i32>(2);
  while (reports < count && pollWait(loop, ready, 5000) > 0) {
    let n = udpRecvFrom(udp, buf, 0, 64, from, meta);
    while (n > 0) {
      const text = String.fromBytes(buf, 0, n);
      const one = toI32(text.indexOf(" "));
      const two = one < 0 ? -1 : toI32(text.indexOf(" ", one + 1));
      const index: i32 = two < 0 ? -1 : parseInt(text.substring(0, one));
      if (index >= 0 && index < count) {
        pins[index] = text.substring(one + 1, two);
        const got: i32 = parseInt(text.substring(two + 1));
        samePort = samePort && got > 0 && (port === 0 || got === port);
        port = got;
        reports = reports + 1;
      }
      n = udpRecvFrom(udp, buf, 0, 64, from, meta);
    }
  }
  console.log(sup > 0 && reports === count && samePort);
  let pinned = true;
  for (let k: i32 = 0; k < count; k++) {
    if (pins[k] !== "true") {
      console.log(`worker ${k} not on CPU ${k} alone`);
      pinned = false;
    }
  }
  console.log(pinned);
  if (sup <= 0 || reports !== count) {
    signal(sup, 15);
    exitCode(sup, 5000);
    netClose(loop);
    netClose(udp);
    return;
  }

  let answered = true;
  for (let k: i32 = 0; k < 8; k++) {
    const answer = request(port);
    answered = answered && answer !== "" && answer !== "refused" && parseInt(answer) < count;
  }
  console.log(answered);

  let steered = true;
  for (let round: i32 = 0; round < 4 && platform === "linux"; round++) {
    for (let cpu: i32 = 0; cpu < count; cpu++) {
      const code = exitCode(spawn([selfPath(), "client", `${port}`, `${cpu}`]), 10000);
      if (code !== 10 + cpu) {
        console.log(`a client on CPU ${cpu} exited ${code}`);
        steered = false;
      }
    }
  }
  console.log(steered);

  console.log(signal(sup, 15));
  console.log(exitCode(sup, 10000) === 0);
  console.log(request(port) === "refused");
  netClose(loop);
  netClose(udp);
};

export const main = (): number => {
  const args = preforkArgs(process.argv);
  if (args.length > 3 && args[1] === "client") {
    return client(parseInt(args[2]), parseInt(args[3]));
  }
  if (args.length > 2 && args[1] === "serve") {
    return supervise(parseInt(args[2]));
  }
  helpers();
  served();
  return 0;
};

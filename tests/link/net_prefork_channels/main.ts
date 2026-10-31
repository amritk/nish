// `nish/net/prefork`'s channels end to end. With no arguments this program is
// the driver; it runs itself again as a supervisor (`<mode> <port> <pid>`, the
// pid its own), which appends its own pid and runs it once more per worker.
// Each worker checks where its ends are and talks over them, then sends the
// driver `w <index> <pid> <ok> <service pid>` over UDP; a supervisor with
// channels sends `s <descriptors>` each time a worker greets it. The driver
// compares those in code, so no pid or descriptor number reaches stdout. It
// checks, in order:
//
//   1. the accessors read the channels flag only just before the worker flag,
//      and `preforkArgs` drops both;
//   2. `sup`: two workers, each holding exactly descriptors 0 to 3, its
//      supervisor channel at 3, whose peer is the supervisor, and which the
//      supervisor's callback answers; a worker killed with SIGKILL comes back
//      with a working channel, and the supervisor holds as many descriptors
//      after the restart as before it. That worker first hands a copy of its
//      end to a holder process, so its death is no hang-up: the holder sees
//      the supervisor's end close only because the supervisor reaped it;
//   3. `svc`: three workers with supervisor channels and worker 0 the service
//      worker. Workers 1 and 2 hold exactly 0 to 4, the service channel at 4,
//      and the service worker answers each with its pid; it holds exactly 0 to
//      5, its end to worker 1 at 4 and to worker 2 at 5. Killing the service
//      worker restarts all three, each with a new pid and working channels to
//      the new service worker; killing worker 2 restarts all three again; the
//      supervisor's descriptor count never moves;
//   4. `solo`: a service worker (1) and no supervisor channels, through
//      `preforkWith`: worker 0's service channel is 3, the service worker's end
//      to it 3, and neither has a supervisor channel;
//   5. `off`: `restart` off and worker 0 the service worker: killing worker 1
//      restarts nothing and signals nothing, and the service worker sees the
//      hang-up on its end to worker 1 and is still running after it.
//
// Every wait is bounded. A worker that finds the driver gone sends the
// supervisor SIGTERM, as in `net_prefork`, so nothing outlives the driver.
import {
  NET_UNIX_SEQPACKET,
  NET_UNIX_STREAM,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  peerCredentials,
  pollAdd,
  pollCreate,
  pollWait,
  udpBind,
  udpRecvFrom,
  udpSendTo,
} from "nish:net";
import { kill, platform, spawn, spawnWithFds, waitPid } from "nish:process";
import {
  PreforkConfig,
  preforkArgs,
  preforkIndex,
  preforkServiceChannel,
  preforkServiceChannelOf,
  preforkSupervise,
  preforkSupervisorChannel,
  preforkWith,
} from "nish/net/prefork";

const WOULD_BLOCK: i32 = -11;

/** This process's pid, from `/proc/self`. */
const selfPid = (): i32 => {
  const self = realpathSync("/proc/self");
  return self !== null ? parseInt(self.substring(6)) : 0;
};

/** This program's path, for running it again. */
const selfPath = (): string => {
  const exe: string | null = realpathSync("/proc/self/exe");
  return exe !== null ? exe : process.argv[0];
};

/** How many descriptors this process holds, the one reading them among them. */
const fdCount = (): i32 => {
  const entries = readdirSync("/proc/self/fd");
  return entries !== null ? toI32(entries.length) : -1;
};

/**
 * Close every descriptor above 2 this process was started holding: a runner
 * that leaks one without close-on-exec would otherwise reach every worker, and
 * the counts below would read the runner, not prefork.
 */
const closeInherited = (): void => {
  const entries = readdirSync("/proc/self/fd");
  if (entries === null) {
    return;
  }
  for (const name of entries) {
    const fd: i32 = parseInt(name);
    if (fd > 2) {
      netClose(fd);
    }
  }
};

/**
 * True when this process holds exactly 0, 1, 2 and `ends` channel ends from 3
 * on, besides the one descriptor that reads the list, the lowest free.
 */
const holdsExactly = (ends: i32): boolean => {
  const entries = readdirSync("/proc/self/fd");
  if (entries === null || entries.length !== ends + 4) {
    return false;
  }
  for (const name of entries) {
    const fd: i32 = parseInt(name);
    if (fd < 0 || fd > ends + 3) {
      return false;
    }
  }
  return true;
};

/** `text`'s bytes into `out`; answers how many. */
const ascii = (text: string, out: u8[]): i32 => {
  for (let i: i32 = 0; i < text.length && i < out.length; i++) {
    out[i] = toU8(text.charCodeAt(i));
  }
  return toI32(text.length);
};

/** Write `text` to `fd`. */
const say = (fd: i32, text: string): void => {
  const out: u8[] = new Array<u8>(64);
  netWrite(fd, out, 0, ascii(text, out));
};

/** The next message on `fd` within `ms`; "" when none comes or it hung up. */
const hear = (fd: i32, ms: i32): string => {
  const buf: u8[] = new Array<u8>(64);
  let n = netRead(fd, buf, 0, 64);
  if (n === WOULD_BLOCK) {
    const loop = pollCreate();
    pollAdd(loop, fd, 1, 0);
    const ready: i32[] = new Array<i32>(2);
    if (pollWait(loop, ready, ms) > 0) {
      n = netRead(fd, buf, 0, 64);
    }
    netClose(loop);
  }
  return n > 0 ? String.fromBytes(buf, 0, n) : "";
};

/** Send `text` to the driver's UDP `port`. */
const tell = (port: i32, text: string): void => {
  const fd = udpBind("127.0.0.1", 0, 0);
  const to: u8[] = new Array<u8>(18);
  netAddress(to, "127.0.0.1", port);
  const out: u8[] = new Array<u8>(64);
  udpSendTo(fd, out, 0, ascii(text, out), to, 0, 0);
  netClose(fd);
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
 * True when the driver (`args[3]`) is gone, after sending the supervisor
 * (`args[4]`) SIGTERM.
 */
const orphaned = (args: string[]): boolean => {
  const driver: i32 = parseInt(args[3]);
  if (driver <= 0 || kill(driver, 0) === 0) {
    return false;
  }
  signal(parseInt(args[4]), 15);
  return true;
};

/** How many workers `mode` runs, and which is the service worker. */
const workerCount = (mode: string): i32 => (mode === "svc" ? 3 : 2);
const serviceOf = (mode: string): i32 => (mode === "svc" || mode === "off" ? 0 : mode === "solo" ? 1 : -1);
/** Whether `mode`'s workers have supervisor channels. */
const toSupervisor = (mode: string): boolean => mode === "sup" || mode === "svc";

/** True when worker `index` of `mode` finds its ends where the docs put them. */
const laidOut = (mode: string, index: i32, argv: string[]): boolean => {
  const service = serviceOf(mode);
  const first: i32 = toSupervisor(mode) ? 4 : 3;
  let ok = preforkSupervisorChannel(argv) === (toSupervisor(mode) ? 3 : -1);
  if (index !== service) {
    ok = ok && preforkServiceChannel(argv) === (service < 0 ? -1 : first);
    return ok && preforkServiceChannelOf(argv, 0) === -1;
  }
  ok = ok && preforkServiceChannel(argv) === -1;
  let next: i32 = first;
  for (let i: i32 = 0; i <= workerCount(mode); i++) {
    const want: i32 = i === index || i === workerCount(mode) ? -1 : next;
    ok = ok && preforkServiceChannelOf(argv, i) === want;
    next = want < 0 ? next : next + 1;
  }
  return ok;
};

/** How many greetings `mode`'s supervisor answers over a whole `run`. */
const greetings = (mode: string): i32 => (mode === "svc" ? 9 : mode === "sup" ? 3 : 0);

/** How many ends worker `index` of `mode` holds. */
const endsOf = (mode: string, index: i32): i32 => {
  const own: i32 = toSupervisor(mode) ? 1 : 0;
  if (serviceOf(mode) < 0) {
    return own;
  }
  return own + (index === serviceOf(mode) ? workerCount(mode) - 1 : 1);
};

/**
 * A worker: check its descriptors before it opens any, greet the supervisor,
 * ask the service worker for its pid, report, then serve its ends until the
 * driver is gone or thirty seconds pass.
 */
const worker = (mode: string, index: i32, argv: string[]): number => {
  let ok = holdsExactly(endsOf(mode, index));
  ok = laidOut(mode, index, argv) && ok;
  const args = preforkArgs(argv);
  const port: i32 = parseInt(args[2]);
  const supervisor: i32 = parseInt(args[4]);
  const sc = preforkSupervisorChannel(argv);
  if (sc >= 0) {
    const who: i32[] = [0, 0, 0];
    ok = ok && peerCredentials(sc, who) === 0 && who[0] === supervisor;
    say(sc, "h");
    ok = ok && hear(sc, 5000) === "a";
  }
  const service = serviceOf(mode);
  let servicePid: i32 = index === service ? selfPid() : 0;
  const vc = preforkServiceChannel(argv);
  if (vc >= 0) {
    say(vc, "p");
    servicePid = parseInt(hear(vc, 5000));
  }
  if (mode === "sup" && index === 1) {
    // A copy of the end outlives this worker, so its death is no hang-up.
    // Before the report: the driver kills this worker once it has it.
    ok = spawnWithFds([selfPath(), "hold", `${port}`], [sc]) > 0 && ok;
  }
  tell(port, `w ${index} ${selfPid()} ${ok ? 1 : 0} ${servicePid}`);

  const loop = pollCreate();
  if (index === service) {
    for (let i: i32 = 0; i < workerCount(mode); i++) {
      const end = preforkServiceChannelOf(argv, i);
      if (end >= 0) {
        pollAdd(loop, end, 1, end);
      }
    }
  }
  const ready: i32[] = new Array<i32>(16);
  const buf: u8[] = new Array<u8>(64);
  for (let k: i32 = 0; k < 600 && !orphaned(args); k++) {
    const n = pollWait(loop, ready, 50);
    for (let r: i32 = 0; r < n; r++) {
      const end = ready[2 * r];
      if (netRead(end, buf, 0, 64) > 0) {
        say(end, `${selfPid()}`);
      } else {
        // The worker at the other end is gone.
        netClose(end);
        tell(port, `g ${index}`);
      }
    }
  }
  return 0;
};

/**
 * Hold descriptor 3, a worker's supervisor channel, until the supervisor
 * closes its end, then tell the driver `h`; ten seconds at most.
 */
const hold = (port: i32): number => {
  const loop = pollCreate();
  pollAdd(loop, 3, 1, 0);
  const ready: i32[] = new Array<i32>(2);
  const buf: u8[] = new Array<u8>(64);
  for (let k: i32 = 0; k < 100; k++) {
    if (pollWait(loop, ready, 100) > 0 && netRead(3, buf, 0, 64) === 0) {
      tell(port, "h");
      return 0;
    }
  }
  return 0;
};

/**
 * Tell the driver how many descriptors this process holds, then answer the
 * greeting with "a": in that order, so the count reaches the driver before the
 * worker's report does.
 */
const greet = (port: i32, _index: i32, fd: i32, _events: i32): void => {
  const buf: u8[] = new Array<u8>(64);
  while (netRead(fd, buf, 0, 64) > 0) {
    tell(port, `s ${fdCount()}`);
    say(fd, "a");
  }
};

/** The supervisor, or a worker: whichever `preforkSupervise` says this process is. */
const supervise = (mode: string, port: i32): number => {
  const config = new PreforkConfig();
  config.tickMs = 10;
  config.graceMs = 2000;
  config.workers = workerCount(mode);
  config.serviceWorker = serviceOf(mode);
  config.restart = mode !== "off";
  config.supervisorChannels = toSupervisor(mode);
  config.channelKind = toSupervisor(mode) ? NET_UNIX_SEQPACKET : NET_UNIX_STREAM;
  const argv: string[] = [];
  for (const arg of process.argv) {
    argv.push(arg);
  }
  if (preforkIndex(argv) < 0) {
    argv.push(`${selfPid()}`);
  }
  const index = toSupervisor(mode) ? preforkSupervise(argv, config, port, greet) : preforkWith(argv, config);
  if (index < 0) {
    return index === -1 ? 0 : 1;
  }
  return worker(mode, index, argv);
};

/** What the driver has heard from one supervisor's workers. */
class Heard {
  pids: i32[];
  oks: boolean[];
  services: i32[];
  counts: i32[];
  holds: i32 = 0;

  constructor() {
    this.pids = [];
    this.oks = [];
    this.services = [];
    this.counts = [];
  }
}

/** The next UDP message on `fd` within `ms`, "" when none comes. */
const message = (fd: i32, loop: i32, ms: i32): string => {
  const buf: u8[] = new Array<u8>(64);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = new Array<i32>(2);
  const ready: i32[] = new Array<i32>(2);
  let n = udpRecvFrom(fd, buf, 0, 64, from, meta);
  if (n <= 0 && pollWait(loop, ready, ms) > 0) {
    n = udpRecvFrom(fd, buf, 0, 64, from, meta);
  }
  return n > 0 ? String.fromBytes(buf, 0, n) : "";
};

/** Field `at` of a space-separated report. */
const field = (text: string, at: i32): i32 => {
  let rest = text;
  for (let k: i32 = 0; k < at; k++) {
    const space = toI32(rest.indexOf(" "));
    if (space < 0) {
      return -1;
    }
    rest = rest.substring(space + 1);
  }
  const space = toI32(rest.indexOf(" "));
  return parseInt(space < 0 ? rest : rest.substring(0, space));
};

/**
 * Listen until every worker has reported with a pid other than `old`'s, ten
 * seconds of quiet at most; true when they all did.
 */
const reported = (fd: i32, loop: i32, heard: Heard, old: i32[]): boolean => {
  let quiet = false;
  let fresh = false;
  while (!fresh && !quiet) {
    const got = message(fd, loop, 10000);
    quiet = got === "";
    if (got === "h") {
      heard.holds = heard.holds + 1;
    } else if (got.startsWith("s ")) {
      heard.counts.push(field(got, 1));
    } else if (got.startsWith("w ")) {
      const index = field(got, 1);
      if (index >= 0 && index < heard.pids.length) {
        heard.pids[index] = field(got, 2);
        heard.oks[index] = field(got, 3) === 1;
        heard.services[index] = field(got, 4);
      }
    }
    fresh = true;
    for (let i: i32 = 0; i < heard.pids.length; i++) {
      fresh = fresh && heard.pids[i] > 0 && heard.pids[i] !== old[i];
    }
  }
  return fresh;
};

/**
 * True once a holder has said its end closed, waiting ten seconds at most.
 * Only the supervisor's `reap` closes it: the holder's copy keeps the worker's
 * death from reaching the supervisor as a hang-up.
 */
const released = (fd: i32, loop: i32, heard: Heard): boolean => {
  for (let k: i32 = 0; k < 50 && heard.holds === 0; k++) {
    if (message(fd, loop, 200) === "h") {
      heard.holds = heard.holds + 1;
    }
  }
  return heard.holds > 0;
};

/** Every worker said ok, and each names the service worker's pid (or none). */
const agreed = (heard: Heard, service: i32): boolean => {
  let ok = true;
  for (let i: i32 = 0; i < heard.pids.length; i++) {
    ok = ok && heard.oks[i] && heard.services[i] === (service < 0 ? 0 : heard.pids[service]);
  }
  return ok;
};

/** Every descriptor count the supervisor sent is the same, and there are `least` at least. */
const steady = (heard: Heard, least: i32): boolean => {
  let ok = heard.counts.length >= least;
  for (const count of heard.counts) {
    ok = ok && count === heard.counts[0] && count > 0;
  }
  return ok;
};

/**
 * True when child `pid` exits 0 within `ms`. A WNOHANG loop; past the deadline
 * the child gets SIGKILL and a second at most to be reaped.
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

/**
 * Run `mode`'s supervisor, wait for every worker, then kill each of `victims`
 * in turn and wait for the workers it restarts: `restarted(victim)` of them.
 * Prints one line for the start, one per victim, one for the descriptor counts
 * and one for the shutdown.
 */
const run = (mode: string, victims: i32[]): void => {
  const fd = udpBind("127.0.0.1", 0, 0);
  const port = netLocalPort(fd);
  const loop = pollCreate();
  pollAdd(loop, fd, 1, 0);
  const sup = spawn([selfPath(), mode, `${port}`, `${selfPid()}`]);
  const heard = new Heard();
  const none: i32[] = [];
  for (let i: i32 = 0; i < workerCount(mode); i++) {
    heard.pids.push(0);
    heard.oks.push(false);
    heard.services.push(0);
    none.push(0);
  }
  const service = serviceOf(mode);
  const started = sup > 0 && reported(fd, loop, heard, none) && agreed(heard, service);
  console.log(started);
  for (const victim of victims) {
    // With a service worker every worker restarts; without, only the victim.
    const old: i32[] = [];
    for (let i: i32 = 0; i < heard.pids.length; i++) {
      old.push(service >= 0 || i === victim ? heard.pids[i] : -1);
    }
    const back = started && signal(heard.pids[victim], 9) && reported(fd, loop, heard, old) && agreed(heard, service);
    console.log(back && (mode !== "sup" || released(fd, loop, heard)));
  }
  console.log(steady(heard, greetings(mode)));
  console.log(signal(sup, 15) && exitsZero(sup, 10000));
  netClose(loop);
  netClose(fd);
};

/**
 * `off`: with `restart` off, killing worker 1 leaves the service worker
 * running and shows it a hang-up on its end. Prints one line for the start,
 * one for the hang-up, one for the shutdown.
 */
const runOff = (): void => {
  const fd = udpBind("127.0.0.1", 0, 0);
  const port = netLocalPort(fd);
  const loop = pollCreate();
  pollAdd(loop, fd, 1, 0);
  const sup = spawn([selfPath(), "off", `${port}`, `${selfPid()}`]);
  const heard = new Heard();
  const none: i32[] = [0, 0];
  for (let i: i32 = 0; i < 2; i++) {
    heard.pids.push(0);
    heard.oks.push(false);
    heard.services.push(0);
  }
  const started = sup > 0 && reported(fd, loop, heard, none) && agreed(heard, 0);
  console.log(started);
  let hungUp = false;
  if (started && signal(heard.pids[1], 9)) {
    for (let k: i32 = 0; k < 50 && !hungUp; k++) {
      const got = message(fd, loop, 200);
      hungUp = got === "g 0";
    }
  }
  // Nothing signals the service worker: it is still there a moment later.
  pause(300);
  console.log(hungUp && signal(heard.pids[0], 0));
  console.log(signal(sup, 15) && exitsZero(sup, 10000));
  netClose(loop);
  netClose(fd);
};

/** Step 1, on made-up arguments. */
const accessors = (): void => {
  const worker: string[] = ["a", "--nish-prefork-channels=3,4", "--nish-prefork-worker=1"];
  console.log(preforkSupervisorChannel(worker) === 3 && preforkServiceChannel(worker) === 4);
  console.log(preforkServiceChannelOf(worker, 0) === -1 && preforkServiceChannelOf(worker, -1) === -1);
  const service: string[] = ["a", "x", "--nish-prefork-channels=-1,-1,-1,3,4", "--nish-prefork-worker=0"];
  console.log(preforkSupervisorChannel(service) === -1 && preforkServiceChannel(service) === -1);
  console.log(preforkServiceChannelOf(service, 0) === -1 && preforkServiceChannelOf(service, 1) === 3);
  console.log(preforkServiceChannelOf(service, 2) === 4 && preforkServiceChannelOf(service, 3) === -1);
  const args = preforkArgs(service);
  console.log(args.length === 2 && args[1] === "x" && preforkArgs(worker).length === 1);
  // Not just before the worker flag, or with no worker flag, it is an argument.
  const loose: string[] = ["a", "--nish-prefork-channels=3", "x", "--nish-prefork-worker=1"];
  console.log(preforkSupervisorChannel(loose) === -1 && preforkArgs(loose).length === 3);
  const bare: string[] = ["a", "--nish-prefork-channels=3"];
  console.log(preforkSupervisorChannel(bare) === -1 && preforkArgs(bare).length === 2);
};

export const main = (): number => {
  const argv = process.argv;
  if (preforkIndex(argv) < 0 && argv.length === 3 && argv[1] === "hold") {
    return hold(parseInt(argv[2]));
  }
  if (preforkIndex(argv) >= 0 || (argv.length > 2 && argv.length < 6)) {
    return supervise(preforkArgs(argv)[1], parseInt(preforkArgs(argv)[2]));
  }
  accessors();
  if (platform !== "linux") {
    // Seqpacket channels and `/proc` are Linux's.
    for (let i: i32 = 0; i < 15; i++) {
      console.log(true);
    }
    return 0;
  }
  closeInherited();
  run("sup", [1]);
  run("svc", [0, 2]);
  run("solo", []);
  runOff();
  return 0;
};

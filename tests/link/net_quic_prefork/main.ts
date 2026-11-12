// QUIC across a prefork group, end to end (docs/h3-multicore.md §7). With no
// arguments this program is the driver; it runs itself again as a supervisor
// (`serve <mode> <tell> <driver>`) with `listenUdp`, which runs it once more
// per worker. A `quic` or `retry` worker serves HTTP/3 on its steered socket,
// every response `worker <k>`; a `light` worker answers any datagram with
// `<k> <pid>`. Each worker tells the driver `<k> <pid> <count> <port>` on its
// UDP port when it starts. The driver checks, in order:
//
//   1. two workers, one steered socket each, on one port (Darwin: one, and the
//      supervisor says on stderr that steering was refused);
//   2. (row 4) a client completes a request, rebinds its port, and the next
//      response reaches the new port from the same worker, which validates
//      the new path;
//   3. (row 5) first DCID bytes below the count and past it both complete, as
//      does a ClientHello split across two Initials whose second comes first
//      from another port, which the owning worker drops (RFC 9000 §9) and no
//      other worker answers, then again from the client's own;
//   4. (row 9) two connections on one client socket, one per worker, each
//      served by its own;
//   5. (row 7) worker 1 killed: its client gets a valid stateless reset from
//      the restarted worker 1, and worker 0's client finishes a request;
//   6. (row 6) a Retry from worker 1 brings the retried Initial back to it;
//   7. (row 8) three light workers, worker 1 killed: byte 0 = 1 reaches the
//      new worker 1, never worker 2;
//   8. (row 12) `NISH_WORKERS=256` panics in the supervisor before any bind
//      or fork; 255 starts, and byte 0 = 254 reaches worker 254;
//   9. (row 14) `NISH_WORKERS=1` runs one worker whose count is 1.
//
// Rows 2 to 9 are Linux's: elsewhere they pass as not applicable. Each wait
// is bounded, and a worker that finds the driver gone sends its supervisor
// SIGTERM, as in `tests/link/net_prefork_pin`.
import { netAddress, netClose, netLocalPort, pollAdd, pollCreate, pollWait, udpBind, udpRecvFrom, udpSendTo } from "nish:net";
import { kill, platform, spawn, spawnSyncTo, waitPid } from "nish:process";
import { Secret, secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { QuicServerConfig, quicStatelessResetToken } from "nish/net/quic";
import { httpFieldBytes } from "nish/net/http-fields";
import { H3_END, H3_ERROR, H3_NEED_MORE, Http3Connection } from "nish/net/http3";
import { Http3Server } from "nish/net/http3-server";
import { PreforkConfig, preforkArgs, preforkListener, preforkUdpCount, preforkUdpListener, preforkWith } from "nish/net/prefork";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPrivate } from "../net_tls_common/server";
import { resetKey } from "../net_quic_conn_replay/server";
import { H3Limits, h3Config, h3QuicConfig } from "../net_http3/peer";
import { Peer, Wire, shortShaped } from "./peer";

/** Whether this is Linux, where the kernel steers. */
const onLinux = (): boolean => platform === "linux";

/** This process's pid on Linux, from `/proc/self`; 0 elsewhere. */
const selfPid = (): i32 => {
  const self = realpathSync("/proc/self");
  return self !== null ? parseInt(self.substring(6)) : 0;
};

/** This program's path, for running it again. */
const selfPath = (): string => {
  const exe: string | null = onLinux() ? realpathSync("/proc/self/exe") : null;
  return exe !== null ? exe : process.argv[0];
};

/** `text`'s bytes. */
const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < text.length; i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
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
 * True when the driver (`args[4]`) is gone, after sending the supervisor
 * (`args[5]`) SIGTERM. Off Linux, where `selfPid` is 0, never.
 */
const orphaned = (args: string[]): boolean => {
  const driver: i32 = args.length > 5 ? parseInt(args[4]) : 0;
  if (driver <= 0 || kill(driver, 0) === 0) {
    return false;
  }
  signal(parseInt(args[5]), 15);
  return true;
};

/** Send `text` to the driver's UDP `port`. */
const tell = (port: i32, text: string): void => {
  const fd = udpBind("127.0.0.1", 0, 0);
  const to: u8[] = new Array<u8>(18);
  netAddress(to, "127.0.0.1", port);
  const out: u8[] = ascii(text);
  udpSendTo(fd, out, 0, toI32(out.length), to, 0, 0);
  netClose(fd);
};

const nowMs = (): i64 => monotonicNanos() / n64(1000000);

/** An HTTP/3 worker: every request answered `worker <index>`, until the driver is gone. */
const serveQuic = (index: i32, fd: i32, count: i32, retry: boolean, args: string[]): number => {
  const config: QuicServerConfig = h3QuicConfig(new H3Limits());
  config.retry = retry;
  config.workerIndex = index;
  config.workerCount = count;
  const entropy: u8[] = new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE);
  crypto.getRandomValues(entropy);
  const server = new Http3Server(config, h3Config(), fd, n32(16), entropy);
  const names: u8[][] = [httpFieldBytes("content-type")];
  const values: u8[][] = [httpFieldBytes("text/plain")];
  const body: u8[] = ascii(`worker ${index}`);
  const loop: i32 = pollCreate();
  pollAdd(loop, fd, n32(1), n32(0));
  const ready: i32[] = new Array<i32>(8);
  while (!orphaned(args)) {
    const wait: i32 = server.timeout(nowMs());
    pollWait(loop, ready, wait < 0 || wait > 1000 ? 1000 : wait);
    const nanos: i64 = monotonicNanos();
    const now: i64 = nanos / n64(1000000);
    server.clock(nanos / n64(1000));
    const key: Secret<u8[]> = secret(leafPrivate());
    server.receive(now, key);
    wipe(key);
    server.tick(now);
    let slot: i32 = server.ready();
    while (slot >= 0) {
      const h3: Http3Connection = server.connection(slot);
      let event: i32 = h3.next();
      while (event !== H3_NEED_MORE && event !== H3_ERROR) {
        if (event === H3_END) {
          h3.respond(h3.stream, n32(200), names, values, false);
          h3.writeData(h3.stream, body, n32(0), toI32(body.length), true);
        }
        event = h3.next();
      }
      slot = server.ready();
    }
    server.flush(now);
  }
  return 0;
};

/** A light worker: every datagram answered `<index> <pid>`, until the driver is gone. */
const serveLight = (index: i32, fd: i32, args: string[]): number => {
  const loop: i32 = pollCreate();
  pollAdd(loop, fd, n32(1), n32(0));
  const ready: i32[] = new Array<i32>(2);
  const rx: u8[] = new Array<u8>(2048);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [n32(0), n32(0)];
  const answer: u8[] = ascii(`${index} ${selfPid()}`);
  while (!orphaned(args)) {
    pollWait(loop, ready, 1000);
    while (udpRecvFrom(fd, rx, n32(0), n32(2048), from, meta) >= 0) {
      udpSendTo(fd, answer, n32(0), toI32(answer.length), from, n32(0), n32(0));
    }
  }
  return 0;
};

/** The supervisor, or a worker: whichever `preforkWith` says this process is. */
const supervise = (mode: string, port: i32): number => {
  const config = new PreforkConfig();
  config.workers = 2;
  config.tickMs = 10;
  config.graceMs = 2000;
  config.listenUdp = true;
  config.listenPort = 0;
  config.listenHost = "127.0.0.1";
  const supervisor = preforkListener(process.argv) < 0;
  const argv: string[] = preforkArgs(process.argv);
  argv.push(supervisor ? `${selfPid()}` : process.argv[process.argv.length - 1]);
  const worker = preforkWith(argv, config);
  if (worker < 0) {
    return worker === -1 ? 0 : 1;
  }
  const fd: i32 = preforkUdpListener(process.argv);
  const count: i32 = preforkUdpCount(process.argv);
  tell(port, `${worker} ${selfPid()} ${count} ${fd >= 0 ? netLocalPort(fd) : fd}`);
  if (fd < 0) {
    return 3;
  }
  const args: string[] = preforkArgs(argv);
  return mode === "light" ? serveLight(worker, fd, args) : serveQuic(worker, fd, count, mode === "retry", args);
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

/** The space-separated numbers of a tell. */
const fields = (line: string): i32[] => {
  const out: i32[] = [];
  let from: i32 = 0;
  let space: i32 = line.indexOf(" ");
  while (space >= 0) {
    out.push(parseInt(line.substring(from, space)));
    from = space + 1;
    space = line.indexOf(" ", from);
  }
  out.push(parseInt(line.substring(from)));
  return out;
};

/** The driver's UDP port the workers tell, and what they told it. */
class Board {
  fd: i32 = -1;
  loop: i32 = -1;
  ready: i32[];
  buf: u8[];
  from: u8[];
  meta: i32[];
  /** Each index's pid, as last told; 0 before. */
  pids: i32[];
  /** Whether every tell named `count` workers and one port. */
  agreed: boolean = true;
  count: i32 = 0;
  port: i32 = 0;
  heard: i32 = 0;

  constructor() {
    this.fd = udpBind("127.0.0.1", 0, 0);
    this.loop = pollCreate();
    pollAdd(this.loop, this.fd, n32(1), n32(0));
    this.ready = new Array<i32>(2);
    this.buf = new Array<u8>(64);
    this.from = new Array<u8>(18);
    this.meta = [n32(0), n32(0)];
    this.pids = [];
    this.reset(0);
  }

  /** Forget what was told, for a group of `count`. */
  reset(count: i32): void {
    this.pids = [];
    for (let k: i32 = 0; k < 256; k++) {
      this.pids.push(0);
    }
    this.agreed = true;
    this.count = count;
    this.port = 0;
    this.heard = 0;
  }

  /** Reads tells until `heard` reaches `want` or nothing comes for `ms`; answers `heard`. */
  listen(want: i32, ms: i32): i32 {
    while (this.heard < want && pollWait(this.loop, this.ready, ms) > 0) {
      let n = udpRecvFrom(this.fd, this.buf, 0, 64, this.from, this.meta);
      while (n > 0) {
        const parts: i32[] = fields(String.fromBytes(this.buf, 0, n));
        const index: i32 = parts.length === 4 ? parts[0] : -1;
        if (index >= 0 && index < 256) {
          this.pids[index] = parts[1];
          const port: i32 = parts[3];
          this.agreed = this.agreed && parts[2] === this.count && port > 0 && (this.port === 0 || port === this.port);
          this.port = port;
          this.heard = this.heard + 1;
        }
        n = udpRecvFrom(this.fd, this.buf, 0, 64, this.from, this.meta);
      }
    }
    return this.heard;
  }

  /** Waits for worker `index` to tell again under a pid other than `old`. */
  restarted(index: i32, old: i32): boolean {
    for (let k: i32 = 0; k < 50 && (this.pids[index] === old || this.pids[index] === 0); k++) {
      this.listen(this.heard + 1, 200);
    }
    return this.pids[index] !== old && this.pids[index] > 0;
  }
}

/** A supervisor of `mode` with `NISH_WORKERS=<workers>`, its stderr to `err`. */
const group = (board: Board, mode: string, workers: i32, err: string): i32 => {
  board.reset(workers);
  const script = `exec env NISH_WORKERS=${workers} "$0" serve ${mode} ${netLocalPort(board.fd)} ${selfPid()} 2>${err}`;
  return spawn(["sh", "-c", script, selfPath()]);
};

/** Stops supervisor `sup`; whether it exited 0. */
const stop = (sup: i32): boolean => signal(sup, 15) && exitCode(sup, 10000) === 0;

/** The text of `path`, or "". */
const text = (path: string): string => {
  const read: string | null = readFileSyncOrNull(path);
  return read === null ? "" : read;
};

/** What `port` answers a short-header-shaped datagram whose byte 0 is `owner`, from a fresh socket. */
const lightAnswer = (port: i32, owner: i32): string => {
  const fd: i32 = udpBind("127.0.0.1", 0, 0);
  const loop: i32 = pollCreate();
  pollAdd(loop, fd, n32(1), n32(0));
  const to: u8[] = new Array<u8>(18);
  netAddress(to, "127.0.0.1", port);
  const datagram: u8[] = [0x40, toU8(owner)];
  for (let k: i32 = 0; k < 30; k++) {
    datagram.push(toU8(k));
  }
  udpSendTo(fd, datagram, n32(0), toI32(datagram.length), to, n32(0), n32(0));
  const ready: i32[] = new Array<i32>(2);
  const rx: u8[] = new Array<u8>(64);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [n32(0), n32(0)];
  let answer = "";
  if (pollWait(loop, ready, 2000) > 0) {
    const n: i32 = udpRecvFrom(fd, rx, n32(0), n32(64), from, meta);
    answer = n > 0 ? String.fromBytes(rx, 0, n) : "";
  }
  netClose(loop);
  netClose(fd);
  return answer;
};

/** The supervisor of two HTTP/3 workers, retry off: rows 10, 4, 5, 9 and 7. */
const quicGroup = (t: Suite, board: Board): void => {
  const err = "build/net-quic-prefork-quic.err";
  const linux: boolean = onLinux();
  const sup: i32 = group(board, "quic", 2, err);
  const workers: i32 = linux ? 2 : 1;
  board.count = workers;
  board.listen(workers, 10000);
  const said: boolean = text(err).indexOf("nish/net/prefork: QUIC steering refused") >= 0;
  t.ok(
    "the group runs one worker per steered socket on one port (elsewhere one, and the supervisor says steering was refused)",
    sup > 0 && board.heard === workers && board.agreed && (linux ? !said : said)
  );
  if (board.heard !== workers) {
    stop(sup);
    return;
  }
  const port: i32 = board.port;

  // Row 4, the acceptance test.
  const w = new Wire(port);
  const p = new Peer(w, 1, 0x41);
  const shook: boolean = p.handshake(false);
  const owner: i32 = shook ? toI32(p.c.serverScid[0]) : -1;
  const first: i32 = shook ? p.get() : -1;
  t.ok("a request completes, served by the worker its connection ID names", first >= 0 && first === owner);
  w.rebind();
  const from: i32 = toI32(p.c.appPayloads.length);
  const second: i32 = shook ? p.get() : -1;
  t.ok("after the client rebinds its port, the next response reaches the new port from the same worker", second >= 0 && second === first);
  t.ok("which validates the new path with a PATH_CHALLENGE", p.challenged(from));
  t.ok("and keeps serving the connection there", shook && p.get() === first);

  if (!linux) {
    stop(sup);
    return;
  }

  // Row 5.
  let below = true;
  for (let b: i32 = 0; b < 2; b++) {
    const one = new Peer(new Wire(port), b, 0x50 + b);
    below = below && one.handshake(false) && one.get() === b && toI32(one.c.serverScid[0]) === b;
  }
  t.ok("Initials whose first DCID byte is below the count complete on the worker it names", below);
  let past = true;
  for (let b: i32 = 2; b < 6; b++) {
    const one = new Peer(new Wire(port), b * 37, 0x50 + b);
    past = past && one.handshake(false) && one.get() === (b * 37) % 2;
  }
  t.ok("and those past it complete on the worker the byte names modulo the count", past);
  const sw = new Wire(port);
  const split = new Peer(sw, 1, 0x5f);
  const splitDone: boolean = split.handshake(true);
  t.ok(
    "a ClientHello in two Initials, the second first from another port: no worker answers that port, and it completes on worker 1",
    splitDone && !split.strayAnswered && split.get() === 1
  );

  // Row 9.
  const shared = new Wire(port);
  const pa = new Peer(shared, 0, 0x90);
  const pb = new Peer(shared, 1, 0x91);
  const both: boolean = pa.handshake(false) && pb.handshake(false);
  t.ok(
    "two connections on one client socket, their IDs issued by worker 0 and worker 1",
    both && toI32(pa.c.serverScid[0]) === 0 && toI32(pb.c.serverScid[0]) === 1
  );
  t.ok("each completes requests served by its own worker", both && pa.get() === 0 && pb.get() === 1 && pa.get() === 0 && pb.get() === 1);

  // Row 7.
  const p0 = new Peer(new Wire(port), 0, 0x70);
  const p1 = new Peer(new Wire(port), 1, 0x71);
  const up: boolean = p0.handshake(false) && p1.handshake(false) && p0.get() === 0 && p1.get() === 1;
  const old: i32 = board.pids[1];
  const killed: boolean = up && signal(old, 9) && board.restarted(1, old);
  t.ok("worker 1 killed, the supervisor starts it again", killed);
  const before: i32 = toI32(p1.unopened.length);
  p1.ping();
  let valid = false;
  if (toI32(p1.unopened.length) > before) {
    const reset: u8[] = p1.unopened[toI32(p1.unopened.length) - 1];
    const token: u8[] = quicStatelessResetToken(resetKey(), p1.c.serverScid);
    const n: i32 = toI32(reset.length);
    valid = shortShaped(reset);
    for (let k: i32 = 0; k < 16; k++) {
      valid = valid && reset[n - 16 + k] === token[k];
    }
  }
  t.ok("its client gets a valid stateless reset from the new worker 1", killed && valid);
  t.ok("and worker 0's client finishes a request on the same connection", up && p0.get() === 0);
  t.ok("SIGTERM stops the group", stop(sup));
};

/** Row 6: a Retry from worker 1 brings the retried Initial back to it. */
const retryGroup = (t: Suite, board: Board): void => {
  const sup: i32 = group(board, "retry", 2, "build/net-quic-prefork-retry.err");
  board.listen(2, 10000);
  const p = new Peer(new Wire(board.port), 3, 0x60);
  const shook: boolean = board.heard === 2 && p.handshake(false);
  t.ok("a Retry from worker 1 carries its index", shook && toI32(p.retryScid.length) === 8 && toI32(p.retryScid[0]) === 1);
  t.ok("and the retried Initial completes on worker 1", shook && toI32(p.c.serverScid[0]) === 1 && p.get() === 1);
  t.ok("SIGTERM stops the retrying group", stop(sup));
};

/** Rows 8, 12 and 14, over light workers. */
const lightGroups = (t: Suite, board: Board): void => {
  let sup: i32 = group(board, "light", 3, "build/net-quic-prefork-light.err");
  board.listen(3, 10000);
  const old: i32 = board.pids[1];
  const restarted: boolean = board.heard === 3 && signal(old, 9) && board.restarted(1, old);
  let reached = restarted;
  for (let k: i32 = 0; k < 8 && reached; k++) {
    reached = lightAnswer(board.port, 1) === `1 ${board.pids[1]}`;
  }
  t.ok("three workers, worker 1 killed: byte 0 = 1 reaches the new worker 1, not worker 2", reached);
  t.ok("SIGTERM stops the light group", stop(sup));

  const err = "build/net-quic-prefork-256.err";
  board.reset(256);
  const rc: i32 = spawnSyncTo(
    ["env", "NISH_WORKERS=256", selfPath(), "serve", "light", `${netLocalPort(board.fd)}`, `${selfPid()}`],
    "",
    err
  );
  t.ok(
    "NISH_WORKERS=256 panics in the supervisor with the count, before any worker starts",
    rc === 1 && text(err).indexOf("nish/net/prefork: listenUdp with 256 workers, above 255") >= 0 && board.listen(1, 300) === 0
  );

  sup = group(board, "light", 255, "build/net-quic-prefork-255.err");
  board.listen(255, 30000);
  t.ok("255 starts, every worker on a socket of a group of 255", board.heard === 255 && board.agreed);
  t.ok("and byte 0 = 254 reaches worker 254", board.heard === 255 && lightAnswer(board.port, 254) === `254 ${board.pids[254]}`);
  t.ok("SIGTERM stops the group of 255", stop(sup));

  sup = group(board, "light", 1, "build/net-quic-prefork-1.err");
  board.listen(1, 10000);
  t.ok("NISH_WORKERS=1 runs one worker, whose count is 1", board.heard === 1 && board.agreed && lightAnswer(board.port, 7) === `0 ${board.pids[0]}`);
  t.ok("SIGTERM stops the group of one", stop(sup));
};

export const main = (): number => {
  const args = preforkArgs(process.argv);
  if (args.length > 3 && args[1] === "serve") {
    return supervise(args[2], parseInt(args[3]));
  }
  const t = new Suite("quic prefork");
  const board = new Board();
  quicGroup(t, board);
  if (onLinux()) {
    retryGroup(t, board);
    lightGroups(t, board);
  }
  return t.done();
};

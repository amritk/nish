// The TechEmpower entry's handler (bench/techempower/server.ts) against the
// rules TFB's verifier applies to its `json` and `plaintext` tests, over
// loopback, with Nish clients in the same readiness loop as the server:
//
//   1. /json: 200, the exact body, `application/json`, `Content-Length` equal
//      to the body, `Server` present, `Date` an IMF-fixdate.
//   2. /plaintext: the same rules, `text/plain`, `Hello, World!`.
//   3. A burst of 16 pipelined /plaintext requests, sent in one write, is
//      answered in order: 16 whole responses and nothing more. A burst of 1000,
//      whose answers are twice what the server's output holds, is answered
//      whole and in order too: a reply the full output held back resumes.
//   4. Every /json answer is serialized again: with the answer buffer
//      overwritten by junk before each request, every answer is still the
//      exact body, which it is only if the writer ran for that request.
//   5. A warmed connection serves 200 requests, /json and /plaintext in turn,
//      and no one of the server's calls moves `Arena.used()`.
//   6. Any other path answers 404; a malformed request answers 400 and closes
//      that connection, and the server goes on serving a new one.
//   7. A pool asked for 0 slots has one, as `Http1Server` clamps it, and
//      answers on it.
//   8. A paused listener, as one out of descriptors is, accepts nothing and
//      bounds the loop's wait; unpaused, it accepts the connection that
//      waited and answers it.
//   9. (Linux, two CPUs or more) `tfbMain`, the program main.ts runs, asked for
//      two workers, serves both on one port: the test runs itself as `serve`,
//      a supervisor whose two workers each report their port and pid over
//      UDP, then as two `client`s pinned to CPUs 0 and 1, whose connections
//      the steered listeners hand to worker 0 and worker 1. SIGTERM to the
//      supervisor stops both, each reporting how many requests it answered:
//      two pids, each of which answered, and the supervisor exits 0. Off
//      Linux, on one CPU, or where a `pin` probe finds CPU 0 or 1 outside the
//      affinity, its five checks are skipped with the reason.
//
// Every wait is bounded: five seconds without a wake is a failure, never a hang.
// The supervisor runs under `timeout`, so it outlives a driver that died by a
// minute at most.
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
  pollRemove,
  pollWait,
  tcpConnect,
  tcpListen,
  udpBind,
  udpRecvFrom,
  udpSendTo,
} from "nish:net";
import { availableParallelism, kill, platform, setCpuAffinity, spawn, waitPid } from "nish:process";
import { preforkArgs } from "nish/net/prefork";
import { Suite } from "nish/testing";
import { TFB_LISTENER, TfbServer, tfbMain } from "../../../bench/techempower/server";
import { ZERO, ascii, range } from "../net_tls_record_common/bytes";
import { Peer } from "../net_tls_record_tcp/harness";

const WOULD_BLOCK: i32 = -11;
/** The first client's token; client `k` is `CLIENTS + k`. A slot's token is the slot. */
const CLIENTS: i32 = 1000;

const DAYS: string = "Mon Tue Wed Thu Fri Sat Sun ";
const MONTHS: string = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec ";

/** True when `name` is one of the three-letter names `list` holds, each followed by a space. */
const named = (list: string, name: string): boolean => {
  const at: i32 = toI32(list.indexOf(`${name} `));
  return toI32(name.length) === 3 && at >= 0 && at % 4 === 0;
};

/** `s` with its ASCII capitals lowered. */
const lower = (s: string): string => {
  let out: string = "";
  for (let k: i32 = 0; k < toI32(s.length); k++) {
    const c: i32 = toI32(s.charCodeAt(k));
    out = out + String.fromCharCode(c >= 65 && c <= 90 ? c + 32 : c);
  }
  return out;
};

/** One response as a client reads it: the status, the header fields, the body. */
class Response {
  status: i32 = 0;
  names: string[];
  values: string[];
  body: string = "";
  /** The `Content-Length` field, or -1 when there is none. */
  length: i32 = -1;

  constructor() {
    this.names = [];
    this.values = [];
  }

  /** The value of the field `name` (matched without case), or empty. */
  field(name: string): string {
    for (let k: i32 = 0; k < toI32(this.names.length); k++) {
      if (lower(this.names[k]) === lower(name)) {
        return this.values[k];
      }
    }
    return "";
  }

  /** How many fields are named `name`, without case. */
  count(name: string): i32 {
    let n: i32 = 0;
    for (const each of this.names) {
      if (lower(each) === lower(name)) {
        n = n + 1;
      }
    }
    return n;
  }
}

/** `bytes[from .. to)` as a string, one character per byte. */
const text = (bytes: u8[], from: i32, to: i32): string => {
  let out: string = "";
  for (let k: i32 = from; k < to && k < toI32(bytes.length); k++) {
    out = out + String.fromCharCode(toI32(bytes[k]));
  }
  return out;
};

/** Where the head of the response at the start of `bytes` ends, past its blank line; -1 while it has not. */
const headEnd = (bytes: u8[]): i32 => {
  for (let k: i32 = 3; k < toI32(bytes.length); k++) {
    if (bytes[k - 3] === 13 && bytes[k - 2] === 10 && bytes[k - 1] === 13 && bytes[k] === 10) {
      return k + 1;
    }
  }
  return -1;
};

/** The decimal number `s` spells, or -1. */
const decimal = (s: string): i32 => {
  if (s.length === 0 || s.length > 9) {
    return -1;
  }
  let n: i32 = 0;
  for (let k: i32 = 0; k < toI32(s.length); k++) {
    const digit: i32 = toI32(s.charCodeAt(k)) - 48;
    if (digit < 0 || digit > 9) {
      return -1;
    }
    n = n * 10 + digit;
  }
  return n;
};

/** True when `s[from .. from + n)` is `n` decimal digits. */
const digits = (s: string, from: i32, n: i32): boolean => decimal(s.substring(from, from + n)) >= 0;

/** True when `s` is an IMF-fixdate (RFC 9110 §5.6.7): `Sun, 06 Nov 1994 08:49:37 GMT`. */
const imfFixdate = (s: string): boolean => {
  if (toI32(s.length) !== 29 || !named(DAYS, s.substring(0, 3)) || !named(MONTHS, s.substring(8, 11))) {
    return false;
  }
  const day: i32 = decimal(s.substring(5, 7));
  const hour: i32 = decimal(s.substring(17, 19));
  const minute: i32 = decimal(s.substring(20, 22));
  const second: i32 = decimal(s.substring(23, 25));
  return (
    s.substring(3, 5) === ", " &&
    s.substring(7, 8) === " " &&
    s.substring(11, 12) === " " &&
    digits(s, 12, 4) &&
    s.substring(16, 17) === " " &&
    s.substring(19, 20) === ":" &&
    s.substring(22, 23) === ":" &&
    s.substring(25, 29) === " GMT" &&
    day >= 1 &&
    day <= 31 &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 60
  );
};

/** The entry's server, its clients, and the loop they share. */
class TfbLoop {
  loop: i32 = -1;
  listener: i32 = -1;
  port: i32 = 0;
  tfb: TfbServer;
  ready: i32[];
  peers: Peer[];
  buf: u8[];
  /** The first thing that went wrong, or empty. */
  failure: string = "";
  /** While set, the server's calls are counted, and those that moved `Arena.used()` either way. */
  measuring: boolean = false;
  calls: i32 = 0;
  moved: i32 = 0;

  constructor(slots: i32) {
    this.ready = new Array<i32>(64);
    this.peers = [];
    this.buf = new Array<u8>(65536);
    this.loop = pollCreate();
    this.listener = tcpListen("127.0.0.1", ZERO, 16);
    this.port = netLocalPort(this.listener);
    this.tfb = new TfbServer(this.loop, this.listener, slots);
  }

  /** Notes the first failure only. */
  fail(what: string): void {
    if (this.failure === "") {
      this.failure = what;
    }
  }

  /** A new client, connected through the loop; its index, or -1. */
  connect(): i32 {
    const addr: u8[] = new Array<u8>(18);
    netAddress(addr, "127.0.0.1", this.port);
    const index: i32 = toI32(this.peers.length);
    const peer = new Peer(CLIENTS + index);
    peer.fd = tcpConnect(addr);
    this.peers.push(peer);
    if (peer.fd < 0) {
      this.fail(`tcpConnect ${peer.fd}`);
      return -1;
    }
    pollAdd(this.loop, peer.fd, 2, peer.token);
    let connected: boolean = false;
    let rounds: i32 = 0;
    while (!connected && rounds < 100 && this.failure === "") {
      connected = this.step(peer.token);
      rounds = rounds + 1;
    }
    const result: i32 = connectResult(peer.fd);
    if (!connected || result !== 0) {
      this.fail(`connect: ${result}`);
      return -1;
    }
    pollModify(this.loop, peer.fd, 1, peer.token);
    return index;
  }

  /** One wait of the loop; true when `token` was among those ready. Five seconds with nothing is a failure. */
  step(token: i32): boolean {
    const n: i32 = pollWait(this.loop, this.ready, 5000);
    if (n <= 0) {
      this.fail("timed out: a wake was lost");
      return false;
    }
    let seen: boolean = false;
    for (let i: i32 = 0; i < n; i++) {
      const who: i32 = this.ready[2 * i];
      if (who === token) {
        seen = true;
      }
      if (who >= CLIENTS) {
        this.readPeer(who - CLIENTS);
      } else {
        const before: i64 = Arena.used();
        this.tfb.dispatch(who, this.ready[2 * i + 1]);
        if (this.measuring && who !== TFB_LISTENER) {
          this.calls = this.calls + 1;
          if (Arena.used() !== before) {
            this.moved = this.moved + 1;
          }
        }
      }
    }
    return seen;
  }

  /** Everything waiting on a client's socket into its `got`. */
  readPeer(index: i32): void {
    const peer: Peer = this.peers[index];
    if (peer.ended || peer.fd < 0) {
      return;
    }
    while (true) {
      const n: i32 = netRead(peer.fd, this.buf, ZERO, toI32(this.buf.length));
      if (n <= 0) {
        if (n !== WOULD_BLOCK) {
          peer.ended = true;
          peer.failure = n;
          pollRemove(this.loop, peer.fd);
        }
        return;
      }
      for (let k: i32 = 0; k < n && k < toI32(this.buf.length); k++) {
        peer.got.push(this.buf[k]);
      }
    }
  }

  /** Sends every byte of `bytes` from client `index`, running the loop while the socket is full. */
  send(index: i32, bytes: u8[]): void {
    const peer: Peer = this.peers[index];
    let sent: i32 = 0;
    let rounds: i32 = 0;
    while (sent < toI32(bytes.length) && rounds < 100000 && this.failure === "") {
      const w: i32 = netWrite(peer.fd, bytes, sent, toI32(bytes.length) - sent);
      if (w > 0) {
        sent = sent + w;
      } else if (w !== WOULD_BLOCK) {
        this.fail(`client write ${w}`);
        return;
      } else {
        this.step(toI32(-1));
      }
      rounds = rounds + 1;
    }
  }

  /** The next whole response client `index` receives, taken out of what it holds; status 0 on a timeout or a cut. */
  response(index: i32): Response {
    const r = new Response();
    const peer: Peer = this.peers[index];
    let end: i32 = headEnd(peer.got);
    while (end < 0 && !peer.ended && this.failure === "") {
      this.step(toI32(-1));
      end = headEnd(peer.got);
    }
    if (end < 0) {
      return r;
    }
    // The status line, then a field per line up to the blank one.
    let line: i32 = 0;
    let lineEnd: i32 = 0;
    while (peer.got[lineEnd] !== 13) {
      lineEnd = lineEnd + 1;
    }
    const statusLine: string = text(peer.got, ZERO, lineEnd);
    if (!statusLine.startsWith("HTTP/1.1 ") || statusLine.length < 12) {
      return r;
    }
    line = lineEnd + 2;
    while (line < end - 2) {
      lineEnd = line;
      while (peer.got[lineEnd] !== 13) {
        lineEnd = lineEnd + 1;
      }
      const field: string = text(peer.got, line, lineEnd);
      const colon: i32 = toI32(field.indexOf(":"));
      if (colon > 0) {
        let from: i32 = colon + 1;
        while (from < toI32(field.length) && field.charCodeAt(from) === 32) {
          from = from + 1;
        }
        r.names.push(field.substring(0, colon));
        r.values.push(field.substring(from, toI32(field.length)));
      }
      line = lineEnd + 2;
    }
    const length: string = r.field("Content-Length");
    r.length = length === "" ? -1 : decimal(length);
    const bodyLength: i32 = r.length < 0 ? 0 : r.length;
    while (toI32(peer.got.length) < end + bodyLength && !peer.ended && this.failure === "") {
      this.step(toI32(-1));
    }
    if (toI32(peer.got.length) < end + bodyLength) {
      return r;
    }
    r.body = text(peer.got, end, end + bodyLength);
    r.status = decimal(statusLine.substring(9, 12));
    peer.take(end + bodyLength);
    return r;
  }

  /** Runs the loop until client `index`'s stream ends; false on a timeout. */
  awaitEnd(index: i32): boolean {
    const peer: Peer = this.peers[index];
    while (!peer.ended && this.failure === "") {
      this.step(toI32(-1));
    }
    return peer.ended;
  }

  /** Runs the loop until nothing is ready for a millisecond. */
  settle(): void {
    for (let rounds: i32 = 0; rounds < 1000; rounds++) {
      const n: i32 = pollWait(this.loop, this.ready, 1);
      if (n <= 0) {
        return;
      }
      for (let i: i32 = 0; i < n; i++) {
        const who: i32 = this.ready[2 * i];
        if (who >= CLIENTS) {
          this.readPeer(who - CLIENTS);
        } else {
          this.tfb.dispatch(who, this.ready[2 * i + 1]);
        }
      }
    }
  }

  shutdown(): void {
    for (const peer of this.peers) {
      if (peer.fd >= 0) {
        netClose(peer.fd);
      }
    }
    netClose(this.listener);
  }
}

const get = (path: string): u8[] => ascii(`GET ${path} HTTP/1.1\r\nHost: tfb\r\n\r\n`);

/** This program's path, for running it again. */
const selfPath = (): string => {
  const exe: string | null = platform === "linux" ? realpathSync("/proc/self/exe") : null;
  return exe !== null ? exe : process.argv[0];
};

/** This process's pid on Linux, from `/proc/self`; 0 elsewhere. */
const selfPid = (): i32 => {
  const self = realpathSync("/proc/self");
  return self !== null ? parseInt(self.substring(6)) : 0;
};

/** Send `text` to the driver's UDP `port`. */
const tell = (port: i32, text: string): void => {
  const fd: i32 = udpBind("127.0.0.1", ZERO, ZERO);
  const to: u8[] = new Array<u8>(18);
  netAddress(to, "127.0.0.1", port);
  const out: u8[] = ascii(text);
  udpSendTo(fd, out, ZERO, toI32(out.length), to, ZERO, ZERO);
  netClose(fd);
};

/** The next UDP message on `fd` within five seconds, split on spaces; empty when none comes. */
const message = (fd: i32, loop: i32): string[] => {
  const buf: u8[] = new Array<u8>(64);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = new Array<i32>(2);
  const ready: i32[] = new Array<i32>(2);
  let n: i32 = udpRecvFrom(fd, buf, ZERO, toI32(64), from, meta);
  if (n <= 0 && pollWait(loop, ready, 5000) > 0) {
    n = udpRecvFrom(fd, buf, ZERO, toI32(64), from, meta);
  }
  const words: string[] = [];
  let start: i32 = 0;
  for (let i: i32 = 0; i <= n; i++) {
    if (i === n || buf[i] === 32) {
      words.push(text(buf, start, i));
      start = i + 1;
    }
  }
  return n > 0 ? words : [];
};

/** Wait `ms` milliseconds. */
const pause = (ms: i32): void => {
  const loop: i32 = pollCreate();
  const ready: i32[] = new Array<i32>(2);
  pollWait(loop, ready, ms);
  netClose(loop);
};

/**
 * True when child `pid` exits 0 within five seconds. A WNOHANG loop, never on
 * a pid that is not positive; past the deadline the child gets SIGKILL and a
 * second more to be reaped.
 */
const exitsZero = (pid: i32): boolean => {
  if (pid <= 0) {
    return false;
  }
  for (let k: i32 = 0; k < 600; k++) {
    const status: i32[] = waitPid(pid, 1);
    if (status[0] !== 0) {
      return status[0] === pid && status[1] === 0 && k < 500;
    }
    if (k === 500) {
      kill(pid, 9);
    }
    pause(10);
  }
  return false;
};

/**
 * `serve <udp port> <port> <nodelay> <host> <slots> <workers>`: main.ts's
 * program, each worker telling the driver `ready <index> <port> <pid>` once it
 * listens and `done <index> <pid> <answered>` once SIGTERM stops it.
 */
const serve = (argv: string[]): i32 => {
  const driver: i32 = parseInt(preforkArgs(argv)[2]);
  return tfbMain(
    argv,
    3,
    (worker: i32, port: i32): void => {
      tell(driver, `ready ${worker} ${port} ${selfPid()}`);
    },
    (worker: i32, tfb: TfbServer): void => {
      tell(driver, `done ${worker} ${selfPid()} ${tfb.answered}`);
    }
  );
};

/** `client <port> <cpu>`: on CPU `cpu` alone, one /plaintext request to `port`; 0 when it is answered as section 2's was. */
const client = (args: string[]): i32 => {
  if (setCpuAffinity(parseInt(args[3])) !== 0) {
    return 2;
  }
  const lb = new TfbLoop(1);
  lb.port = parseInt(args[2]);
  const c: i32 = lb.connect();
  if (c < 0) {
    return 3;
  }
  lb.send(c, get("/plaintext"));
  const r: Response = lb.response(c);
  return r.status === 200 && r.body === "Hello, World!" && imfFixdate(r.field("Date")) ? 0 : 1;
};

/** Section 9: two workers of `tfbMain` on one port, each answering. */
const workers = (t: Suite): void => {
  const names: string[] = [
    "tfbMain with two workers starts both on one port",
    "a connection made on CPU 0 is answered",
    "a connection made on CPU 1 is answered",
    "two worker processes answered on the one port",
    "SIGTERM stops both and the supervisor exits 0",
  ];
  if (platform !== "linux" || availableParallelism() < 2) {
    for (const name of names) {
      t.skip(name, "two workers need Linux and two CPUs");
    }
    return;
  }
  // prefork pins worker k to CPU k, and each client pins itself to one of them:
  // a cpuset without CPU 0 or 1 cannot run this section, so it says so.
  const self: string = selfPath();
  if (!exitsZero(spawn([self, "pin", "0"])) || !exitsZero(spawn([self, "pin", "1"]))) {
    for (const name of names) {
      t.skip(name, "CPUs 0 and 1 are not both in this process's affinity");
    }
    return;
  }
  const fd: i32 = udpBind("127.0.0.1", ZERO, ZERO);
  const loop: i32 = pollCreate();
  pollAdd(loop, fd, 1, ZERO);
  // `--foreground` hands SIGTERM to the supervisor alone: without it `timeout`
  // signals its whole group, the workers die beside the supervisor, and one
  // it restarts before it reads its own SIGTERM makes the checks below flaky.
  const sup: i32 = spawn(["timeout", "--foreground", "60", self, "serve", `${netLocalPort(fd)}`, "0", "1", "127.0.0.1", "64", "2"]);
  // Each worker's `ready`: its index, its port and its pid, by index.
  const ports: i32[] = [0, 0];
  const pids: i32[] = [0, 0];
  for (let k: i32 = 0; k < 2 && sup > 0; k++) {
    const m: string[] = message(fd, loop);
    if (m.length === 4 && m[0] === "ready") {
      const at: i32 = parseInt(m[1]) === 1 ? 1 : 0;
      ports[at] = parseInt(m[2]);
      pids[at] = parseInt(m[3]);
    }
  }
  const up: boolean = ports[0] > 0 && ports[0] === ports[1] && pids[0] > 0 && pids[1] > 0;
  t.ok(names[0], up);
  for (let cpu: i32 = 0; cpu < 2; cpu++) {
    t.ok(names[1 + cpu], up && exitsZero(spawn([self, "client", `${ports[0]}`, `${cpu}`])));
  }
  // Each worker's `done`: its pid and how many requests it answered, by index.
  const answered: i32[] = [0, 0];
  const stopped: i32[] = [0, 0];
  if (sup > 0) {
    kill(sup, 15);
    for (let k: i32 = 0; k < 2; k++) {
      const m: string[] = message(fd, loop);
      if (m.length === 4 && m[0] === "done") {
        const at: i32 = parseInt(m[1]) === 1 ? 1 : 0;
        stopped[at] = parseInt(m[2]);
        answered[at] = parseInt(m[3]);
      }
    }
  }
  const both: boolean = up && pids[0] !== pids[1] && stopped[0] === pids[0] && stopped[1] === pids[1];
  t.ok(names[3], both && answered[0] > 0 && answered[1] > 0);
  t.ok(names[4], exitsZero(sup));
  netClose(loop);
  netClose(fd);
};

/** Every rule the verifier applies to one answer, as checks named after `what`. */
const verify = (t: Suite, what: string, r: Response, body: string, type: string): void => {
  t.eqI32(`${what}: status 200`, r.status, toI32(200));
  t.eqStr(`${what}: the body, byte for byte`, r.body, body);
  t.eqStr(`${what}: Content-Type`, r.field("Content-Type"), type);
  t.eqI32(`${what}: Content-Length is the body's length`, r.length, toI32(body.length));
  t.eqI32(`${what}: one Content-Length`, r.count("Content-Length"), toI32(1));
  t.ok(`${what}: Server is present`, r.field("Server") !== "");
  t.ok(`${what}: Date is an IMF-fixdate`, imfFixdate(r.field("Date")));
};

export const main = (): i32 => {
  const args: string[] = preforkArgs(process.argv);
  if (args.length > 1 && args[1] === "serve") {
    return serve(process.argv);
  }
  if (args.length > 3 && args[1] === "client") {
    return client(args);
  }
  if (args.length > 2 && args[1] === "pin") {
    return setCpuAffinity(parseInt(args[2])) === 0 ? 0 : 2;
  }
  const t = new Suite("tfb entry");
  const json: string = '{"message":"Hello, World!"}';
  const plain: string = "Hello, World!";
  t.ok("the date check takes RFC 9110's example", imfFixdate("Sun, 06 Nov 1994 08:49:37 GMT"));
  t.ok("and refuses the obsolete RFC 850 form", !imfFixdate("Sunday, 06-Nov-94 08:49:37 GMT"));
  t.ok("and a time with no GMT", !imfFixdate("Sun, 06 Nov 1994 08:49:37 UTC"));

  const lb = new TfbLoop(8);
  const c: i32 = lb.connect();

  // --- 1 and 2. One of each ---------------------------------------------------------------------
  lb.send(c, get("/json"));
  verify(t, "/json", lb.response(c), json, "application/json");
  lb.send(c, get("/plaintext"));
  verify(t, "/plaintext", lb.response(c), plain, "text/plain");

  // --- 3. A pipelined burst of 16 ---------------------------------------------------------------
  const burst: u8[] = [];
  for (let k: i32 = 0; k < 16; k++) {
    for (const b of get("/plaintext")) {
      burst.push(b);
    }
  }
  const answeredBefore: i32 = lb.tfb.answered;
  lb.send(c, burst);
  let whole: i32 = 0;
  for (let k: i32 = 0; k < 16; k++) {
    const r: Response = lb.response(c);
    if (r.status === 200 && r.body === plain && r.length === 13 && imfFixdate(r.field("Date"))) {
      whole = whole + 1;
    }
  }
  t.eqI32("16 pipelined requests in one write are answered by 16 whole responses", whole, toI32(16));
  lb.settle();
  t.eqI32("and nothing more follows them", toI32(lb.peers[c].got.length), toI32(0));
  t.eqI32("and the handler answered each once", lb.tfb.answered - answeredBefore, toI32(16));
  // The order shows in the pipelined /json and /plaintext mix below.
  const mixed: u8[] = [];
  for (let k: i32 = 0; k < 16; k++) {
    for (const b of get(k % 3 === 0 ? "/json" : "/plaintext")) {
      mixed.push(b);
    }
  }
  lb.send(c, mixed);
  let inOrder: i32 = 0;
  for (let k: i32 = 0; k < 16; k++) {
    const r: Response = lb.response(c);
    const want: string = k % 3 === 0 ? json : plain;
    if (r.status === 200 && r.body === want) {
      inOrder = inOrder + 1;
    }
  }
  t.eqI32("a pipelined mix of /json and /plaintext is answered in the order asked", inOrder, toI32(16));
  // The parser holds 16386 bytes of input; 528 of these 31-byte requests fill
  // it, and their answers, some 145 bytes each, overrun the 65280 bytes the
  // output gives replies.
  const deep: u8[] = [];
  for (let k: i32 = 0; k < 1000; k++) {
    for (const b of ascii(`GET ${k % 4 === 3 ? "/plaintext" : "/json"} HTTP/1.1\r\nHost: t\r\n\r\n`)) {
      deep.push(b);
    }
  }
  const deepBefore: i32 = lb.tfb.answered;
  lb.send(c, deep);
  let deepInOrder: i32 = 0;
  for (let k: i32 = 0; k < 1000; k++) {
    const r: Response = lb.response(c);
    const want: string = k % 4 === 3 ? plain : json;
    if (r.status === 200 && r.body === want && r.length === toI32(want.length)) {
      deepInOrder = deepInOrder + 1;
    }
  }
  t.eqI32("1000 pipelined requests, past what the output holds, are answered whole and in order", deepInOrder, toI32(1000));
  lb.settle();
  t.eqI32("and nothing more follows the 1000", toI32(lb.peers[c].got.length), toI32(0));
  t.eqI32("and the handler answered each of them once", lb.tfb.answered - deepBefore, toI32(1000));

  // --- 4. /json is serialized per request -------------------------------------------------------
  // Junk of the answer's length and more over the whole buffer: an answer
  // served from what the buffer held reads `X`s, not the body.
  const before: i32 = lb.tfb.serialized;
  let fresh: i32 = 0;
  for (let k: i32 = 0; k < 5; k++) {
    for (let i: i32 = 0; i < toI32(lb.tfb.jsonBuf.length); i++) {
      lb.tfb.jsonBuf[i] = toU8(88);
    }
    lb.send(c, get("/json"));
    const r: Response = lb.response(c);
    if (r.status === 200 && r.body === json && r.length === toI32(json.length)) {
      fresh = fresh + 1;
    }
  }
  t.eqI32("five /json requests over a junked buffer are five exact bodies", fresh, toI32(5));
  t.eqI32("five /json requests are five serializations by the writer", lb.tfb.serialized - before, toI32(5));
  lb.send(c, get("/plaintext"));
  lb.response(c);
  t.eqI32("and a /plaintext request is none", lb.tfb.serialized - before, toI32(5));

  // --- 5. 200 warmed requests, the arena flat ---------------------------------------------------
  lb.calls = 0;
  lb.moved = 0;
  lb.measuring = true;
  let served: i32 = 0;
  for (let k: i32 = 0; k < 200; k++) {
    lb.send(c, get(k % 2 === 0 ? "/json" : "/plaintext"));
    const r: Response = lb.response(c);
    if (r.status === 200 && r.body === (k % 2 === 0 ? json : plain)) {
      served = served + 1;
    }
  }
  lb.measuring = false;
  t.eqI32("a warmed connection answers 200 requests", served, toI32(200));
  t.ok("and the server was called for them", lb.calls >= toI32(200));
  t.eqI32("and no server call moved Arena.used()", lb.moved, toI32(0));

  // --- 6. 404, then a malformed request ---------------------------------------------------------
  lb.send(c, get("/nothing"));
  const missing: Response = lb.response(c);
  t.eqI32("another path answers 404", missing.status, toI32(404));
  t.ok("with Server and an IMF-fixdate Date", missing.field("Server") !== "" && imfFixdate(missing.field("Date")));
  t.eqI32("and a Content-Length equal to its body", missing.length, toI32(missing.body.length));
  lb.send(c, ascii("GET /json HTTP/1.1\r\nHost tfb\r\n\r\n"));
  const refused: Response = lb.response(c);
  t.eqI32("a header line with no colon answers 400", refused.status, toI32(400));
  t.ok("and the server closes that connection", lb.awaitEnd(c));
  const d: i32 = lb.connect();
  lb.send(d, get("/plaintext"));
  verify(t, "a new connection after the 400", lb.response(d), plain, "text/plain");

  if (lb.failure !== "") {
    t.fail("the loop", lb.failure);
  }
  lb.shutdown();

  // --- 7. A pool of 0 slots is a pool of one ----------------------------------------------------
  const one = new TfbLoop(0);
  const e: i32 = one.connect();
  one.send(e, get("/json"));
  verify(t, "a pool asked for 0 slots", one.response(e), json, "application/json");
  if (one.failure !== "") {
    t.fail("the 0-slot loop", one.failure);
  }
  one.shutdown();

  // --- 8. A paused listener waits, then accepts -------------------------------------------------
  const held = new TfbLoop(4);
  t.eqI32("an unpaused loop waits without a timeout", held.tfb.waitMs(), toI32(-1));
  held.tfb.pause();
  t.ok("a paused one waits a bounded time", held.tfb.waitMs() > 0);
  const f: i32 = held.connect();
  held.send(f, get("/json"));
  held.settle();
  t.eqI32("and accepts nothing while paused", toI32(held.peers[f].got.length), ZERO);
  held.tfb.unpause();
  t.eqI32("unpaused, it waits without a timeout again", held.tfb.waitMs(), toI32(-1));
  verify(t, "and answers the connection that waited", held.response(f), json, "application/json");
  if (held.failure !== "") {
    t.fail("the paused loop", held.failure);
  }
  held.shutdown();

  // --- 9. Two workers on one port ---------------------------------------------------------------
  workers(t);
  return t.done();
};

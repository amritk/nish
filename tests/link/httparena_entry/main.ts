// The HttpArena entry (bench/httparena) against the rules HttpArena's
// validate.sh applies to the profiles it serves, over loopback. The test runs
// itself as `serve`, `arenaMain` with one worker on ports the kernel picks and
// the eight-item dataset beside this file, and as `pg`, the stand-in
// PostgreSQL of pg.ts that `DATABASE_URL` names; the driver is a plain client
// of the server:
//
//   1. GET /baseline11 with a random `a` and `b` answers their sum,
//      `text/plain`; a POST adds its body's number, sent with
//      `Content-Length`, with a lower-cased `content-length`, and chunked.
//   2. A request split inside its request line, after the request line, and
//      between its head and its body is answered as one.
//   3. 16 pipelined requests in one write, /pipeline and /baseline11 by
//      turns, are answered in the order sent: `ok`, then each its own sum.
//   4. 32 overlapping /delay requests on 32 connections, watched together,
//      are each answered with their own `ms`, none before that long since it
//      was sent, and all of them in well under the time the delays add up to:
//      the timer holds them, not the loop. /delay/abc answers 400.
//   5. /json/2?m=3 without Accept-Encoding is the exact body, uncompressed,
//      `application/json`; with `Accept-Encoding: gzip` it is gzip, whose
//      inflation is that body. /json/abc answers 400, and an `m` of 18
//      digits is capped, not an overflow.
//   6. /async-db answers the stand-in's rows priced in [min, max] as the
//      exact body, past the limit's row; without parameters ids 1 to 5,
//      the rows its default min 10 and max 50 select; without a limit, 50 of
//      60 rows in range; its limit clamped to 1 .. 50; and, with the query
//      refused, 200 `application/json` with no items. pg.ts refuses a Parse of
//      any text but the spec's query, so a wrong query fails the exact bodies.
//   7. Another path answers 404.
//   8. Over h2c with prior knowledge, /baseline2 answers `:status` 200 and the
//      sum, and /json/2?m=3 the exact body.
//   9. SIGTERM stops the server and it exits 0.
//
// Every wait is bounded: five seconds without a wake is a failure, never a
// hang. The driver kills and reaps both children whatever its checks found;
// a driver that died leaves the stand-in to exit once idle for 20 seconds,
// and the server to answer until it is stopped.
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
  tcpConnect,
  udpBind,
  udpRecvFrom,
  udpSendTo,
} from "nish:net";
import { kill, platform, spawn, waitPid } from "nish:process";
import { gzipDecompress } from "nish/compress/gzip";
import { preforkArgs } from "nish/net/prefork";
import { Suite } from "nish/testing";
import { ArenaServer, arenaMain } from "../../../bench/httparena/server";
import { ZERO, ascii } from "../net_tls_record_common/bytes";
import { pgStandIn } from "./pg";

const WOULD_BLOCK: i32 = -11;
const DATASET: string = "tests/link/httparena_entry/dataset.json";
/** /json/2?m=3 over the dataset's first two items. */
const JSON_BODY: string =
  '{"items":[{"id":1,"name":"Alpha Widget","category":"electronics","price":328,"quantity":15,"active":true,' +
  '"tags":["sale","heavy-duty","popular"],"rating":{"score":48,"count":53},"total":14760},' +
  '{"id":2,"name":"Pro Valve","category":"tools","price":347,"quantity":95,"active":true,' +
  '"tags":["fast","heavy-duty","new","wireless"],"rating":{"score":15,"count":259},"total":98895}],"count":2}';
const EMPTY_DB: string = '{"items":[],"count":0}';
/** /async-db?min=20&max=50&limit=3 over pg.ts's rows: 2 to 4, as row 5, priced 50, is past the limit. */
const DB_BODY: string =
  '{"items":[{"id":2,"name":"Item 2","category":"tools","price":20,"quantity":7,"active":true,' +
  '"tags":["t2", "x"],"rating":{"score":2,"count":14}},' +
  '{"id":3,"name":"Item 3","category":"toys","price":30,"quantity":8,"active":false,' +
  '"tags":["t3", "x"],"rating":{"score":3,"count":21}},' +
  '{"id":4,"name":"Item 4","category":"tools","price":40,"quantity":9,"active":true,' +
  '"tags":["t4", "x"],"rating":{"score":4,"count":28}}],"count":3}';

/** How many items an /async-db body holds, by its `"id":` keys, or -1 when its `count` is not that. */
const dbItems = (body: string): i32 => {
  let n: i32 = 0;
  let at: i32 = toI32(body.indexOf('{"id":'));
  while (at >= 0) {
    n = n + 1;
    at = toI32(body.indexOf('{"id":', at + 1));
  }
  return body.endsWith(`],"count":${n}}`) ? n : toI32(-1);
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

/** `bytes[from .. to)` as a string, one character per byte. */
const text = (bytes: u8[], from: i32, to: i32): string => {
  let out: string = "";
  for (let k: i32 = from; k < to && k < toI32(bytes.length); k++) {
    out = out + String.fromCharCode(toI32(bytes[k]));
  }
  return out;
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

/** Where the head of the response at the start of `bytes` ends, past its blank line; -1 while it has not. */
const headEnd = (bytes: u8[]): i32 => {
  for (let k: i32 = 3; k < toI32(bytes.length); k++) {
    if (bytes[k - 3] === 13 && bytes[k - 2] === 10 && bytes[k - 1] === 13 && bytes[k] === 10) {
      return k + 1;
    }
  }
  return -1;
};

/** Milliseconds on the monotonic clock. */
const nowMs = (): i64 => monotonicNanos() / toI64(1000000);

/** Wait `ms` milliseconds. */
const pause = (ms: i32): void => {
  const loop: i32 = pollCreate();
  const ready: i32[] = new Array<i32>(2);
  pollWait(loop, ready, ms);
  netClose(loop);
};

/** One response as a client reads it: the status, the header fields, the body's bytes. */
class Response {
  status: i32 = 0;
  names: string[];
  values: string[];
  body: u8[];

  constructor() {
    this.names = [];
    this.values = [];
    this.body = [];
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

  text(): string {
    return text(this.body, ZERO, toI32(this.body.length));
  }
}

/** One client connection with its own loop; every wait on it is five seconds at most. */
class Conn {
  fd: i32 = -1;
  loop: i32 = -1;
  got: u8[];
  ended: boolean = false;
  buf: u8[];
  ready: i32[];

  constructor(port: i32) {
    this.got = [];
    this.buf = new Array<u8>(65536);
    this.ready = new Array<i32>(2);
    const addr: u8[] = new Array<u8>(18);
    netAddress(addr, "127.0.0.1", port);
    this.loop = pollCreate();
    this.fd = tcpConnect(addr);
    if (this.fd < 0) {
      this.ended = true;
      return;
    }
    pollAdd(this.loop, this.fd, 2, ZERO);
    if (pollWait(this.loop, this.ready, 5000) <= 0 || connectResult(this.fd) !== 0) {
      this.ended = true;
    }
    pollModify(this.loop, this.fd, 1, ZERO);
  }

  /** Writes every byte of `bytes`, waiting while the socket is full. */
  send(bytes: u8[]): void {
    let sent: i32 = 0;
    while (sent < toI32(bytes.length) && !this.ended) {
      const w: i32 = netWrite(this.fd, bytes, sent, toI32(bytes.length) - sent);
      if (w > 0) {
        sent = sent + w;
      } else if (w !== WOULD_BLOCK) {
        this.ended = true;
      } else {
        pause(1);
      }
    }
  }

  /** Reads what has arrived into `got`, without waiting; true once `got` holds anything. */
  poll(): boolean {
    if (!this.ended && pollWait(this.loop, this.ready, ZERO) > 0) {
      const n: i32 = netRead(this.fd, this.buf, ZERO, toI32(this.buf.length));
      if (n > 0) {
        for (let k: i32 = 0; k < n; k++) {
          this.got.push(this.buf[k]);
        }
      } else if (n !== WOULD_BLOCK) {
        this.ended = true;
      }
    }
    return toI32(this.got.length) > 0;
  }

  /** Reads what arrives within five seconds into `got`; false on a timeout or an end. */
  fill(): boolean {
    if (this.ended) {
      return false;
    }
    if (pollWait(this.loop, this.ready, 5000) <= 0) {
      this.ended = true;
      return false;
    }
    const n: i32 = netRead(this.fd, this.buf, ZERO, toI32(this.buf.length));
    if (n === WOULD_BLOCK) {
      return true;
    }
    if (n <= 0) {
      this.ended = true;
      return false;
    }
    for (let k: i32 = 0; k < n; k++) {
      this.got.push(this.buf[k]);
    }
    return true;
  }

  /** The first `n` bytes of `got`, taken out. */
  take(n: i32): u8[] {
    const out: u8[] = this.got.slice(0, n);
    this.got = this.got.slice(n);
    return out;
  }

  /** The next whole HTTP/1.1 response, framed by its `Content-Length`; status 0 on a timeout or a cut. */
  response(): Response {
    const r = new Response();
    let end: i32 = headEnd(this.got);
    while (end < 0 && this.fill()) {
      end = headEnd(this.got);
    }
    if (end < 0) {
      return r;
    }
    const head: u8[] = this.take(end);
    // The status line, then a field per line up to the blank one.
    let lineEnd: i32 = 0;
    while (head[lineEnd] !== 13) {
      lineEnd = lineEnd + 1;
    }
    const status: string = text(head, ZERO, lineEnd);
    let length: i32 = 0;
    let line: i32 = lineEnd + 2;
    while (line < end - 2) {
      lineEnd = line;
      while (head[lineEnd] !== 13) {
        lineEnd = lineEnd + 1;
      }
      const field: string = text(head, line, lineEnd);
      const colon: i32 = toI32(field.indexOf(":"));
      if (colon > 0) {
        let from: i32 = colon + 1;
        while (from < toI32(field.length) && field.charCodeAt(from) === 32) {
          from = from + 1;
        }
        const name: string = field.substring(0, colon);
        const value: string = field.substring(from, toI32(field.length));
        r.names.push(name);
        r.values.push(value);
        if (lower(name) === "content-length") {
          length = decimal(value);
        }
      }
      line = lineEnd + 2;
    }
    while (toI32(this.got.length) < length && this.fill()) {}
    if (length < 0 || toI32(this.got.length) < length || !status.startsWith("HTTP/1.1 ") || status.length < 12) {
      return r;
    }
    r.body = this.take(length);
    r.status = decimal(status.substring(9, 12));
    return r;
  }

  /** The next whole HTTP/2 frame: its type, flags and stream, then its payload; empty on a timeout or a cut. */
  frame(): u8[] {
    while (toI32(this.got.length) < 9 && this.fill()) {}
    if (toI32(this.got.length) < 9) {
      return [];
    }
    const len: i32 = (toI32(this.got[0]) << 16) | (toI32(this.got[1]) << 8) | toI32(this.got[2]);
    while (toI32(this.got.length) < 9 + len && this.fill()) {}
    if (toI32(this.got.length) < 9 + len) {
      return [];
    }
    return this.take(9 + len).slice(3);
  }

  close(): void {
    if (this.fd >= 0) {
      netClose(this.fd);
    }
    netClose(this.loop);
  }
}

const get = (path: string): u8[] => ascii(`GET ${path} HTTP/1.1\r\nHost: arena\r\n\r\n`);

/** The one response `request` gets on a connection of its own. */
const once = (port: i32, request: u8[]): Response => {
  const c = new Conn(port);
  c.send(request);
  const r: Response = c.response();
  c.close();
  return r;
};

/** `request`, written in pieces cut at each of `cuts`, with a pause after each. */
const split = (port: i32, request: string, cuts: i32[]): Response => {
  const c = new Conn(port);
  const bytes: u8[] = ascii(request);
  let from: i32 = 0;
  for (const cut of cuts) {
    c.send(bytes.slice(from, cut));
    pause(30);
    from = cut;
  }
  c.send(bytes.slice(from));
  const r: Response = c.response();
  c.close();
  return r;
};

/** A random number in [0, 65536). */
const random = (): i32 => {
  const b: u8[] = new Array<u8>(2);
  crypto.getRandomValues(b);
  return (toI32(b[0]) << 8) | toI32(b[1]);
};

/** An HTTP/2 frame header for `len` payload bytes. */
const frameHead = (len: i32, type: i32, flags: i32, stream: i32): u8[] => [
  toU8((len >> 16) & 255),
  toU8((len >> 8) & 255),
  toU8(len & 255),
  toU8(type),
  toU8(flags),
  toU8((stream >> 24) & 127),
  toU8((stream >> 16) & 255),
  toU8((stream >> 8) & 255),
  toU8(stream & 255),
];

/**
 * The connection preface, an empty SETTINGS frame, and a GET of `path` on
 * stream 1: `:method GET` and `:scheme http` indexed, `:path` and
 * `:authority` literals with an indexed name, END_STREAM and END_HEADERS.
 */
const h2Get = (path: string): u8[] => {
  const out: u8[] = ascii("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");
  for (const b of frameHead(ZERO, toI32(4), ZERO, ZERO)) {
    out.push(b);
  }
  const block: u8[] = [toU8(0x82), toU8(0x86), toU8(0x44), toU8(path.length)];
  for (const b of ascii(path)) {
    block.push(b);
  }
  block.push(toU8(0x41));
  block.push(toU8(5));
  for (const b of ascii("arena")) {
    block.push(b);
  }
  for (const b of frameHead(toI32(block.length), toI32(1), toI32(5), toI32(1))) {
    out.push(b);
  }
  for (const b of block) {
    out.push(b);
  }
  return out;
};

/** What stream 1 answered: whether its first header was `:status` 200 (static index 8), then its data. */
class H2Answer {
  ok: boolean = false;
  data: u8[];

  constructor() {
    this.data = [];
  }
}

/** Reads frames until stream 1 ends: its HEADERS and its DATA, every other frame passed over. */
const h2Answer = (c: Conn): H2Answer => {
  const a = new H2Answer();
  for (let k: i32 = 0; k < 64; k++) {
    const f: u8[] = c.frame();
    if (f.length === 0) {
      return a;
    }
    const type: i32 = toI32(f[0]);
    const flags: i32 = toI32(f[1]);
    const stream: i32 = toI32(f[5]);
    if (stream === 1 && type === 1) {
      a.ok = f.length > 6 && f[6] === 0x88;
    }
    if (stream === 1 && type === 0) {
      for (let i: i32 = 6; i < toI32(f.length); i++) {
        a.data.push(f[i]);
      }
    }
    if (stream === 1 && (type === 0 || type === 1) && (flags & 1) === 1) {
      return a;
    }
  }
  return a;
};

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

/** The next UDP message on `fd` within `ms` milliseconds, split on spaces; empty when none comes. */
const message = (fd: i32, loop: i32, ms: i32): string[] => {
  const buf: u8[] = new Array<u8>(64);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = new Array<i32>(2);
  const ready: i32[] = new Array<i32>(2);
  let n: i32 = udpRecvFrom(fd, buf, ZERO, toI32(64), from, meta);
  if (n <= 0 && pollWait(loop, ready, ms) > 0) {
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

/**
 * Child `pid`'s exit code, or -1000 when it has not exited within `ms`
 * milliseconds; that child gets SIGKILL and a second more to be reaped.
 */
const exitStatus = (pid: i32, ms: i32): i32 => {
  const ticks: i32 = ms / 10;
  for (let k: i32 = 0; k < ticks + 100 && pid > 0; k++) {
    const status: i32[] = waitPid(pid, 1);
    if (status[0] < 0) {
      return status[0];
    }
    if (status[0] === pid) {
      return k < ticks ? status[1] : toI32(-1000);
    }
    if (k === ticks) {
      kill(pid, 9);
    }
    pause(10);
  }
  return toI32(-1000);
};

/**
 * `serve <udp port> <port> <h2c port> <host> <slots> <workers> <dataset>`:
 * main.ts's program, telling the driver `ready <port> <h2c port> <pid>` once
 * it listens and `done <answered>` once SIGTERM stops it.
 */
const serve = (argv: string[]): i32 => {
  const driver: i32 = parseInt(preforkArgs(argv)[2]);
  return arenaMain(
    argv,
    3,
    (worker: i32, port: i32, h2cPort: i32): void => {
      tell(driver, `ready ${port} ${h2cPort} ${selfPid()}`);
    },
    (worker: i32, server: ArenaServer): void => {
      tell(driver, `done ${server.answered}`);
    }
  );
};

export const main = (): i32 => {
  const args: string[] = preforkArgs(process.argv);
  if (args.length > 1 && args[1] === "serve") {
    return serve(process.argv);
  }
  if (args.length > 2 && args[1] === "pg") {
    return pgStandIn(parseInt(args[2]));
  }
  const t = new Suite("httparena entry");
  if (platform !== "linux") {
    t.skip("the entry serves", "the entry's server runs on Linux");
    return t.done();
  }
  const fd: i32 = udpBind("127.0.0.1", ZERO, ZERO);
  const udp: i32 = pollCreate();
  pollAdd(udp, fd, 1, ZERO);
  const pg: i32 = spawn([selfPath(), "pg", `${netLocalPort(fd)}`]);
  const db: string[] = message(fd, udp, 5000);
  t.ok("the stand-in PostgreSQL listens", db.length === 2 && db[0] === "pg");
  if (db.length !== 2) {
    exitStatus(pg, 0);
    return t.done();
  }
  const sup: i32 = spawn([
    "env",
    `DATABASE_URL=postgres://bench:bench@127.0.0.1:${db[1]}/benchmark`,
    selfPath(),
    "serve",
    `${netLocalPort(fd)}`,
    "0",
    "0",
    "127.0.0.1",
    "256",
    "1",
    DATASET,
  ]);
  const up: string[] = message(fd, udp, 5000);
  const started: boolean = up.length === 4 && up[0] === "ready";
  t.ok("the entry starts and listens on both ports", started);
  if (!started) {
    exitStatus(sup, 0);
    exitStatus(pg, 0);
    return t.done();
  }
  const port: i32 = parseInt(up[1]);
  const h2c: i32 = parseInt(up[2]);
  const pid: i32 = parseInt(up[3]);

  // --- 1. baseline11 --------------------------------------------------------------------------
  const a: i32 = random();
  const b: i32 = random();
  const sum: Response = once(port, get(`/baseline11?a=${a}&b=${b}`));
  t.eqI32("GET /baseline11 answers 200", sum.status, toI32(200));
  t.eqStr("with the sum of a random a and b", sum.text(), `${a + b}`);
  t.eqStr("as text/plain", sum.field("Content-Type"), "text/plain");
  const post: Response = once(
    port,
    ascii(`POST /baseline11?a=${a}&b=${b} HTTP/1.1\r\nHost: arena\r\nContent-Length: 2\r\n\r\n17`)
  );
  t.eqStr("POST /baseline11 adds its body's number", post.text(), `${a + b + 17}`);
  const lowered: Response = once(
    port,
    ascii("POST /baseline11?a=1&b=2 HTTP/1.1\r\nhost: arena\r\ncontent-length: 3\r\n\r\n400")
  );
  t.eqStr("and reads a lower-cased content-length", lowered.text(), "403");
  const chunked: Response = once(
    port,
    ascii(
      "POST /baseline11?a=1&b=2 HTTP/1.1\r\nHost: arena\r\nTransfer-Encoding: chunked\r\n\r\n" +
        "2\r\n13\r\n1\r\n4\r\n0\r\n\r\n"
    )
  );
  t.eqI32("a chunked POST answers 200", chunked.status, toI32(200));
  t.eqStr("with the number its chunks spell added", chunked.text(), "137");

  // --- 2. Split requests ----------------------------------------------------------------------
  const line: string = "GET /baseline11?a=20&b=22 HTTP/1.1\r\n";
  const whole: string = `${line}Host: arena\r\n\r\n`;
  t.eqStr("a request split inside its request line is answered as one", split(port, whole, [7]).text(), "42");
  t.eqStr("and one split after its request line", split(port, whole, [toI32(line.length)]).text(), "42");
  const body: string = "POST /baseline11?a=1&b=1 HTTP/1.1\r\nHost: arena\r\nContent-Length: 2\r\n\r\n";
  t.eqStr(
    "and a POST split between its head and its body",
    split(port, `${body}40`, [toI32(body.length)]).text(),
    "42"
  );
  t.eqStr(
    "and one split in three places",
    split(port, `${body}40`, [3, toI32(line.length) - 2, toI32(body.length) + 1]).text(),
    "42"
  );

  // --- 3. Pipelined -----------------------------------------------------------------------------
  // By turns, so an answer out of order or one answered twice is a miss.
  const pipe = new Conn(port);
  const burst: u8[] = [];
  for (let k: i32 = 0; k < 16; k++) {
    for (const x of get(k % 2 === 0 ? "/pipeline" : `/baseline11?a=${k}&b=100`)) {
      burst.push(x);
    }
  }
  pipe.send(burst);
  let oks: i32 = 0;
  for (let k: i32 = 0; k < 16; k++) {
    const r: Response = pipe.response();
    const want: string = k % 2 === 0 ? "ok" : `${k + 100}`;
    if (r.status === 200 && r.text() === want && r.field("Content-Type") === "text/plain") {
      oks = oks + 1;
    }
  }
  t.eqI32("16 pipelined requests in one write are answered in the order sent", oks, toI32(16));
  pipe.close();

  // --- 4. Overlapping delays --------------------------------------------------------------------
  // Delays of 200 to 510 ms add up to 11.5 s; held by the timer, they end
  // together once the longest has passed.
  const delays: Conn[] = [];
  const begun: i64 = nowMs();
  for (let k: i32 = 0; k < 32; k++) {
    const c = new Conn(port);
    c.send(get(`/delay/${200 + 10 * k}`));
    delays.push(c);
  }
  // Watched together, so each answer's first byte is timed as it comes.
  const came: i64[] = [];
  for (let k: i32 = 0; k < 32; k++) {
    came.push(toI64(-1));
  }
  let waiting: i32 = 32;
  while (waiting > 0 && nowMs() - begun < toI64(5000)) {
    for (let k: i32 = 0; k < 32; k++) {
      if (came[k] < 0 && delays[k].poll()) {
        came[k] = nowMs() - begun;
        waiting = waiting - 1;
      }
    }
    pause(1);
  }
  const took: i64 = nowMs() - begun;
  let answered: i32 = 0;
  let early: i32 = 0;
  for (let k: i32 = 0; k < 32; k++) {
    const r: Response = delays[k].response();
    if (r.status === 200 && r.text() === `${200 + 10 * k}`) {
      answered = answered + 1;
    }
    if (came[k] < toI64(200 + 10 * k)) {
      early = early + 1;
    }
    delays[k].close();
  }
  t.eqI32("32 overlapping /delay requests are each answered with their ms", answered, toI32(32));
  t.eqI32("none of them sooner than its ms", early, ZERO);
  t.ok("and all of them in under 3 s, not the 11.5 s their delays add up to", took < toI64(3000));
  t.eqI32("/delay/abc answers 400", once(port, get("/delay/abc")).status, toI32(400));

  // --- 5. json-comp -----------------------------------------------------------------------------
  const plain: Response = once(port, get("/json/2?m=3"));
  t.eqI32("/json/2?m=3 answers 200", plain.status, toI32(200));
  t.eqStr("with the first two items, each total times m", plain.text(), JSON_BODY);
  t.eqStr("as application/json", plain.field("Content-Type"), "application/json");
  t.eqStr("and with no Accept-Encoding, uncompressed", plain.field("Content-Encoding"), "");
  const packed: Response = once(
    port,
    ascii("GET /json/2?m=3 HTTP/1.1\r\nHost: arena\r\nAccept-Encoding: gzip, deflate, br\r\n\r\n")
  );
  t.eqStr("with Accept-Encoding gzip it is gzip", packed.field("Content-Encoding"), "gzip");
  t.eqStr("still application/json", packed.field("Content-Type"), "application/json");
  const inflated: u8[] = new Array<u8>(4096);
  const n: i32 = gzipDecompress(packed.body, ZERO, toI32(packed.body.length), inflated, ZERO, toI32(4096));
  t.eqStr("whose inflation is the uncompressed body", text(inflated, ZERO, n), JSON_BODY);
  t.ok("and smaller than it", toI32(packed.body.length) < toI32(JSON_BODY.length));
  t.eqI32("/json/abc answers 400", once(port, get("/json/abc")).status, toI32(400));
  const big: Response = once(port, get("/json/1?m=999999999999999999"));
  t.ok("an m of 18 digits is capped at a million", big.text().indexOf('"total":4920000000}') > 0);

  // --- 6. async-db --------------------------------------------------------------------------------
  const rows: Response = once(port, get("/async-db?min=20&max=50&limit=3"));
  t.eqI32("/async-db answers 200", rows.status, toI32(200));
  t.eqStr("with the rows priced in [min, max], up to the limit, as the exact body", rows.text(), DB_BODY);
  t.eqStr("as application/json", rows.field("Content-Type"), "application/json");
  const plainDb: string = once(port, get("/async-db")).text();
  t.eqI32("without parameters, the 5 rows priced in min 10 .. max 50", dbItems(plainDb), toI32(5));
  t.ok("from the first row", plainDb.startsWith('{"items":[{"id":1,'));
  t.eqI32("without a limit, 50 of the 60 rows in range", dbItems(once(port, get("/async-db?min=0&max=1000")).text()), toI32(50));
  t.eqI32("a limit of 500 is 50", dbItems(once(port, get("/async-db?min=0&max=1000&limit=500")).text()), toI32(50));
  t.eqI32("and one of 0 is 1", dbItems(once(port, get("/async-db?min=0&max=1000&limit=0")).text()), toI32(1));
  const refused: Response = once(port, get("/async-db?min=13&max=50&limit=5"));
  t.eqI32("with the query refused it answers 200", refused.status, toI32(200));
  t.eqStr("with no items", refused.text(), EMPTY_DB);
  t.eqStr("and the next query is answered again", once(port, get("/async-db?min=20&max=50&limit=3")).text(), DB_BODY);

  // --- 7. 404 -----------------------------------------------------------------------------------
  t.eqI32("another path answers 404", once(port, get("/nothing")).status, toI32(404));

  // --- 8. h2c -----------------------------------------------------------------------------------
  const h = new Conn(h2c);
  h.send(h2Get("/baseline2?a=19&b=23"));
  const two: H2Answer = h2Answer(h);
  t.ok("h2c /baseline2 answers :status 200", two.ok);
  t.eqStr("with the sum", text(two.data, ZERO, toI32(two.data.length)), "42");
  h.close();
  const hj = new Conn(h2c);
  hj.send(h2Get("/json/2?m=3"));
  const json: H2Answer = h2Answer(hj);
  t.ok("h2c /json/2?m=3 answers :status 200", json.ok);
  t.eqStr("with the exact body", text(json.data, ZERO, toI32(json.data.length)), JSON_BODY);
  hj.close();

  // --- 9. SIGTERM -------------------------------------------------------------------------------
  kill(pid, 15);
  const done: string[] = message(fd, udp, 5000);
  t.ok("SIGTERM stops the server", done.length === 2 && done[0] === "done" && parseInt(done[1]) > 0);
  t.eqI32("and it exits 0", exitStatus(sup, 5000), ZERO);
  exitStatus(pg, 0);
  netClose(udp);
  netClose(fd);
  return t.done();
};

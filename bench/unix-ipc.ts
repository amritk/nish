// Echo round trips between two processes, over three transports: loopback TCP
// with TCP_NODELAY on both ends, a Unix stream socketpair and a Unix seqpacket
// socketpair. One program in two roles:
//
//   unix-ipc <tcp|stream|seqpacket> <size> <warm> <count> <child cpu|->
//   unix-ipc peer <tcp|stream|seqpacket> <port> <size> <warm> <count>
//
// The first is the client. For `stream` and `seqpacket` it makes a pair with
// `unixSocketPair` and starts itself as the peer with `spawnWithFds`, which
// hands the peer one end as descriptor 3; for `tcp` it listens on 127.0.0.1
// with `tcpListenFlags` flag 2 (TCP_NODELAY on the accepted socket) and the
// peer connects with `tcpConnect`, which sets TCP_NODELAY itself. A child cpu
// other than `-` starts the peer under `taskset -c <cpu>`.
//
// Both sides wait in an epoll loop, as a server does: every socket is
// non-blocking. The client sends `size` bytes and waits for them back; the peer
// reads exactly `size` bytes before it answers (a stream may bring them in
// pieces; a seqpacket read must bring the one message whole) and writes them
// back. The client checks every byte of every reply against what it sent,
// whose first eight bytes are the round trip's number, so a transport that
// drops, reorders or merges messages fails the run rather than timing it.
//
// `warm` round trips go first, untimed; then `count` timed ones. The client
// prints
// `transport T size S count N ns W p50 A p99 B user U sys K peer_user V peer_sys L`:
// W the timed loop's wall time in nanoseconds, A and B the median and 99th
// percentile round trip in nanoseconds (10 ns buckets), U and K its own user
// and system CPU over the loop in microseconds, V and L the peer's, which the
// peer measures over its own timed loop with getrusage and sends back.
import {
  NET_UNIX_SEQPACKET,
  NET_UNIX_STREAM,
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
  unixSocketPair,
} from "nish:net";
import { monotonicNanos, spawnWithFds, waitPid } from "nish:process";

declare function calloc(count: u64, size: u64): CPtr | null;
declare function free(p: CPtr): void;
declare function getrusage(who: i32, usage: CPtr): i32;
declare function bcopy(src: CPtr, dst: u8[], n: u64): void;

/** `netRead` and `netWrite`: nothing to do now. */
const AGAIN: i32 = -11;
const READABLE: i32 = 1;
const WRITABLE: i32 = 2;
/** Long enough for any round trip on a working transport. */
const TIMEOUT_MS: i32 = 10000;
/** The latency histogram: 10 ns buckets up to 2 ms, the last holding the rest. */
const BUCKET_NS: i64 = 10;
const BUCKETS: i32 = 200000;
/** The peer's report: its user and system CPU microseconds, eight bytes each. */
const REPORT: i32 = 16;

/** The little-endian i64 at `b[at, at + 8)`. */
const word = (b: readonly u8[], at: i32): i64 => {
  let v: i64 = 0;
  for (let k: i32 = 7; k >= 0; k--) {
    v = v * 256 + toI64(b[at + k]);
  }
  return v;
};

/** `v` as eight little-endian bytes at `b[at, at + 8)`. */
const putWord = (b: u8[], at: i32, v: i64): void => {
  let x: i64 = v;
  for (let k: i32 = 0; k < 8; k++) {
    b[at + k] = toU8(x & 255);
    x = x >> 8;
  }
};

/** The process's user (`at` 0) or system (`at` 16) CPU time so far, in microseconds. */
const cpuMicros = (at: i32): i64 => {
  const p: CPtr | null = calloc(toU64(1), toU64(144));
  if (p === null) {
    return 0;
  }
  getrusage(0, p);
  const usage: u8[] = new Array<u8>(32);
  bcopy(p, usage, toU64(usage.length));
  free(p);
  return word(usage, at) * 1000000 + word(usage, at + 8);
};

/** One socket on its own epoll loop, and the transport's framing. */
class Wire {
  readonly fd: i32;
  readonly loop: i32;
  readonly ready: i32[];
  /** A seqpacket read is one message, so it must bring a whole one. */
  readonly packets: boolean;
  events: i32 = 0;

  constructor(fd: i32, packets: boolean) {
    this.fd = fd;
    this.packets = packets;
    this.loop = pollCreate();
    this.ready = new Array<i32>(2);
    this.events = READABLE;
    pollAdd(this.loop, fd, READABLE, 0);
  }

  /** Waits until the socket is ready for `events`; false on a timeout or an error. */
  wait(events: i32): boolean {
    if (events !== this.events) {
      pollModify(this.loop, this.fd, events, 0);
      this.events = events;
    }
    return pollWait(this.loop, this.ready, TIMEOUT_MS) > 0;
  }

  /**
   * Reads exactly `n` bytes into `buf[0, n)`, whose length must be more than
   * `n`, so a seqpacket message longer than `n` shows as one. False when the
   * peer closes, fails or sends a message of another size.
   */
  readExact(buf: u8[], n: i32): boolean {
    let got: i32 = 0;
    while (got < n) {
      if (!this.wait(READABLE)) {
        return false;
      }
      const r: i32 = netRead(
        this.fd,
        buf,
        got,
        this.packets ? toI32(buf.length) : n - got,
      );
      if (r === AGAIN) {
        continue;
      }
      if (r <= 0 || (this.packets && r !== n)) {
        return false;
      }
      got += r;
    }
    return true;
  }

  /** Writes `buf[0, n)`, waiting when the socket is full; false when the peer is gone. */
  writeAll(buf: readonly u8[], n: i32): boolean {
    let put: i32 = 0;
    while (put < n) {
      const w: i32 = netWrite(this.fd, buf, put, n - put);
      if (w === AGAIN) {
        if (!this.wait(WRITABLE)) {
          return false;
        }
        continue;
      }
      if (w <= 0 || (this.packets && w !== n)) {
        return false;
      }
      put += w;
    }
    return true;
  }
}

/** The echo peer: `warm` untimed and `count` timed echoes of `size` bytes, then its CPU over the timed ones. */
const peer = (wire: Wire, size: i32, warm: i32, count: i32): i32 => {
  const buf: u8[] = new Array<u8>(size + 1);
  for (let i: i32 = 0; i < warm; i++) {
    if (!wire.readExact(buf, size) || !wire.writeAll(buf, size)) {
      return 1;
    }
  }
  const user0: i64 = cpuMicros(0);
  const sys0: i64 = cpuMicros(16);
  for (let i: i32 = 0; i < count; i++) {
    if (!wire.readExact(buf, size) || !wire.writeAll(buf, size)) {
      return 1;
    }
  }
  const user: i64 = cpuMicros(0) - user0;
  const sys: i64 = cpuMicros(16) - sys0;
  const report: u8[] = new Array<u8>(REPORT);
  putWord(report, 0, user);
  putWord(report, 8, sys);
  if (!wire.writeAll(report, REPORT)) {
    return 1;
  }
  // Wait for the client to close, so the report is read before this end goes.
  wire.readExact(buf, 1);
  return 0;
};

/** The peer's side of a TCP run: connects to the client's listener on `port`. */
const tcpPeer = (port: i32): i32 => {
  const address: u8[] = new Array<u8>(18);
  netAddress(address, "127.0.0.1", port);
  const fd: i32 = tcpConnect(address);
  if (fd < 0) {
    return fd;
  }
  const loop: i32 = pollCreate();
  const ready: i32[] = new Array<i32>(2);
  pollAdd(loop, fd, WRITABLE, 0);
  const got: i32 = pollWait(loop, ready, TIMEOUT_MS);
  netClose(loop);
  if (got <= 0 || connectResult(fd) !== 0) {
    netClose(fd);
    return -111;
  }
  return fd;
};

/** One round trip's message: its number in the first eight bytes, a pattern after. */
const fill = (msg: u8[], size: i32, i: i32): void => {
  putWord(msg, 0, toI64(i));
  for (let k: i32 = 8; k < size; k++) {
    msg[k] = toU8((i + k) & 255);
  }
};

/** Whether `reply[0, size)` is `msg[0, size)`. */
const same = (msg: readonly u8[], reply: readonly u8[], size: i32): boolean => {
  for (let k: i32 = 0; k < size; k++) {
    if (msg[k] !== reply[k]) {
      return false;
    }
  }
  return true;
};

/** The round trip, in ns, at quantile `q` of `hist`'s `total`: its bucket's low end. */
const quantile = (hist: readonly i32[], total: i32, q: f64): i64 => {
  const want: i64 = toI64(Math.ceil(q * toF64(total)));
  let seen: i64 = 0;
  for (let b: i32 = 0; b < BUCKETS; b++) {
    seen += toI64(hist[b]);
    if (seen >= want) {
      return toI64(b) * BUCKET_NS;
    }
  }
  return toI64(BUCKETS) * BUCKET_NS;
};

/** The client: starts the peer, times `count` round trips after `warm`, prints the line. */
const client = (
  transport: string,
  size: i32,
  warm: i32,
  count: i32,
  childCpu: string,
): i32 => {
  const self: string = process.argv[0];
  let fd: i32 = -1;
  let listener: i32 = -1;
  let port: i32 = 0;
  const handed: i32[] = [];
  if (transport === "tcp") {
    listener = tcpListenFlags("127.0.0.1", 0, 1, 2);
    if (listener < 0) {
      console.log(`listen failed: ${listener}`);
      return 1;
    }
    port = netLocalPort(listener);
  } else {
    const pair: i32[] = [0, 0];
    const made: i32 = unixSocketPair(
      transport === "stream" ? NET_UNIX_STREAM : NET_UNIX_SEQPACKET,
      pair,
    );
    if (made !== 0) {
      console.log(`socketpair failed: ${made}`);
      return 1;
    }
    fd = pair[0];
    handed.push(pair[1]);
  }
  const argv: string[] = [];
  if (childCpu !== "-") {
    argv.push("taskset");
    argv.push("-c");
    argv.push(childCpu);
  }
  argv.push(self);
  argv.push("peer");
  argv.push(transport);
  argv.push(`${port}`);
  argv.push(`${size}`);
  argv.push(`${warm}`);
  argv.push(`${count}`);
  const pid: i32 = spawnWithFds(argv, handed);
  if (pid < 0) {
    console.log(`spawn failed: ${pid}`);
    return 1;
  }
  if (transport === "tcp") {
    const wait = new Wire(listener, false);
    const peerAddress: u8[] = new Array<u8>(18);
    if (wait.wait(READABLE)) {
      fd = tcpAccept(listener, peerAddress);
    }
    netClose(wait.loop);
    netClose(listener);
    if (fd < 0) {
      console.log(`accept failed: ${fd}`);
      return 1;
    }
  } else {
    netClose(handed[0]);
  }

  const wire = new Wire(fd, transport === "seqpacket");
  const msg: u8[] = new Array<u8>(size);
  const reply: u8[] = new Array<u8>(size + 1);
  for (let i: i32 = 0; i < warm; i++) {
    fill(msg, size, i);
    if (
      !wire.writeAll(msg, size) ||
      !wire.readExact(reply, size) ||
      !same(msg, reply, size)
    ) {
      console.log(`warm-up round trip ${i} failed`);
      return 1;
    }
  }
  const hist: i32[] = new Array<i32>(BUCKETS);
  const user0: i64 = cpuMicros(0);
  const sys0: i64 = cpuMicros(16);
  const t0: i64 = monotonicNanos();
  for (let i: i32 = 0; i < count; i++) {
    fill(msg, size, warm + i);
    const start: i64 = monotonicNanos();
    if (!wire.writeAll(msg, size) || !wire.readExact(reply, size)) {
      console.log(`round trip ${i} failed`);
      return 1;
    }
    const took: i64 = monotonicNanos() - start;
    if (!same(msg, reply, size)) {
      console.log(`round trip ${i}: the reply is not what was sent`);
      return 1;
    }
    const b: i64 = took / BUCKET_NS;
    const at: i32 = b < toI64(BUCKETS) ? toI32(b) : BUCKETS - 1;
    hist[at] += 1;
  }
  const ns: i64 = monotonicNanos() - t0;
  const user: i64 = cpuMicros(0) - user0;
  const sys: i64 = cpuMicros(16) - sys0;
  const report: u8[] = new Array<u8>(REPORT + 1);
  if (!wire.readExact(report, REPORT)) {
    console.log("no report from the peer");
    return 1;
  }
  netClose(fd);
  const status: i32[] = waitPid(pid, 0);
  if (status[1] !== 0) {
    console.log(`the peer exited ${status[1]}`);
    return 1;
  }
  console.log(
    `transport ${transport} size ${size} count ${count} ns ${ns} p50 ${quantile(hist, count, 0.5)}` +
      ` p99 ${quantile(hist, count, 0.99)} user ${user} sys ${sys}` +
      ` peer_user ${word(report, 0)} peer_sys ${word(report, 8)}`,
  );
  return 0;
};

export const main = (): i32 => {
  const args: readonly string[] = process.argv;
  const peerRole: boolean = args.length === 7 && args[1] === "peer";
  const transport: string = peerRole
    ? args[2]
    : args.length === 6
      ? args[1]
      : "";
  if (
    transport !== "tcp" &&
    transport !== "stream" &&
    transport !== "seqpacket"
  ) {
    console.log(
      "usage: unix-ipc <tcp|stream|seqpacket> <size> <warm> <count> <child cpu|->",
    );
    console.log(
      "       unix-ipc peer <tcp|stream|seqpacket> <port> <size> <warm> <count>",
    );
    return 2;
  }
  if (peerRole) {
    const size: i32 = parseInt(args[4]);
    if (size < 8) {
      return 2;
    }
    const fd: i32 = transport === "tcp" ? tcpPeer(parseInt(args[3])) : 3;
    if (fd < 0) {
      return 1;
    }
    const answer: i32 = peer(
      new Wire(fd, transport === "seqpacket"),
      size,
      parseInt(args[5]),
      parseInt(args[6]),
    );
    netClose(fd);
    return answer;
  }
  const size: i32 = parseInt(args[2]);
  const count: i32 = parseInt(args[4]);
  if (size < 8 || count < 1) {
    console.log("the size must be at least 8 and the count at least 1");
    return 2;
  }
  return client(transport, size, parseInt(args[3]), count, args[5]);
};

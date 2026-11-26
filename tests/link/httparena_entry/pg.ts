// A loopback stand-in PostgreSQL backend for the entry's /async-db query, run
// as the test's `pg <udp port>` mode in a process of its own. It listens on a
// port the kernel picks, tells the driver `pg <port>`, and answers every
// connection's startup with `trust` (AuthenticationOk, client_encoding UTF8,
// BackendKeyData, ReadyForQuery). Then, at each Sync, it answers what came
// before it: a Parse with ParseComplete, a statement Describe with the
// query's three int8 parameters and its nine columns, and a Bind and Execute
// with the rows of `pgItem` whose price is in [$1, $2], the first $3 of them,
// then `SELECT n`. A Bind whose $1 is 13 is refused instead, with SQLSTATE
// 42P01, as a missing table is. A Parse of any text but `SPEC_SQL` is refused
// with 42601, and so is every Bind on that connection after it.
//
// It exits once 20 seconds pass with no connection or message, so it
// outlives a driver that died by that much at most.
import { netAddress, netClose, netLocalPort, netRead, netWrite, pollAdd, pollCreate, pollWait, tcpAccept, tcpListen, udpBind, udpSendTo } from "nish:net";
import { ZERO, ascii } from "../net_tls_record_common/bytes";

const WOULD_BLOCK: i32 = -11;
/** The rows the stand-in's `items` table holds. */
const PG_ROWS: i32 = 60;
/** A Bind whose $1 is this is refused with 42P01. */
const PG_REFUSED_MIN: i32 = 13;
/**
 * The query HttpArena's spec states for `/async-db`, copied from the
 * operation's description in `site/static/openapi.json` at HttpArena commit
 * 3388e4586647ad7d9fd09faec3363f078ded0a9e, not from the entry's db.ts, so a
 * changed query there fails the exact-body checks.
 */
const SPEC_SQL: string =
  "SELECT id, name, category, price, quantity, active, tags, rating_score, rating_count FROM items WHERE price BETWEEN $1 AND $2 LIMIT $3";
/** How long the stand-in waits with nothing to do before it exits, in milliseconds. */
const IDLE_MS: i32 = 20000;

/**
 * Row `k` of `items`, 1 to `PG_ROWS`, as the nine text cells the query's
 * columns read: price `10k`, every third row inactive, tags in jsonb's text form.
 */
const pgItem = (k: i32): string[] => [
  `${k}`,
  `Item ${k}`,
  k % 2 === 0 ? "tools" : "toys",
  `${10 * k}`,
  `${k + 5}`,
  k % 3 === 0 ? "f" : "t",
  `["t${k}", "x"]`,
  `${k % 50}`,
  `${7 * k}`,
];

/** The columns of the query, with their type OIDs: int8 20, text 25, bool 16, jsonb 3802. */
const columns = (): string[] => ["id", "name", "category", "price", "quantity", "active", "tags", "rating_score", "rating_count"];
const TYPES: readonly i32[] = [20, 25, 25, 20, 20, 16, 3802, 20, 20];

/** One connection: what it sent and not yet read, what it is owed, and what it asked for since the last Sync. */
class PgPeer {
  fd: i32;
  input: u8[];
  out: u8[];
  started: boolean = false;
  parsed: boolean = false;
  described: boolean = false;
  bound: boolean = false;
  params: i32[];
  mark: i32 = 0;
  /** A Parse on this connection held another query than `SPEC_SQL`. */
  wrongQuery: boolean = false;

  constructor(fd: i32) {
    this.fd = fd;
    this.input = [];
    this.out = [];
    this.params = [];
  }

  byte(b: i32): void {
    this.out.push(toU8(b));
  }

  int16(v: i32): void {
    this.byte((v >> 8) & 255);
    this.byte(v & 255);
  }

  int32(v: i32): void {
    this.byte((v >> 24) & 255);
    this.byte((v >> 16) & 255);
    this.byte((v >> 8) & 255);
    this.byte(v & 255);
  }

  cstr(s: string): void {
    for (const b of ascii(s)) {
      this.out.push(b);
    }
    this.byte(0);
  }

  /** Starts a message of `type`; `finish` writes its length. */
  begin(type: i32): void {
    this.byte(type);
    this.mark = toI32(this.out.length);
    this.int32(0);
  }

  finish(): void {
    const len: i32 = toI32(this.out.length) - this.mark;
    this.out[this.mark] = toU8((len >> 24) & 255);
    this.out[this.mark + 1] = toU8((len >> 16) & 255);
    this.out[this.mark + 2] = toU8((len >> 8) & 255);
    this.out[this.mark + 3] = toU8(len & 255);
  }

  ready(): void {
    this.begin(90);
    this.byte(73);
    this.finish();
  }

  /** The big-endian i32 of `input` at `p`. */
  at32(p: i32): i32 {
    const b: u8[] = this.input;
    return (toI32(b[p]) << 24) | (toI32(b[p + 1]) << 16) | (toI32(b[p + 2]) << 8) | toI32(b[p + 3]);
  }

  at16(p: i32): i32 {
    return (toI32(this.input[p]) << 8) | toI32(this.input[p + 1]);
  }

  /** The text cell of `len` bytes at `p` as a number, -1 for anything but digits. */
  number(p: i32, len: i32): i32 {
    let n: i32 = 0;
    for (let k: i32 = p; k < p + len; k++) {
      const d: i32 = toI32(this.input[k]) - 48;
      if (d < 0 || d > 9 || n > 100000000) {
        return -1;
      }
      n = n * 10 + d;
    }
    return len > 0 ? n : -1;
  }

  /** Parse's query text, past its statement name, in `body .. end`; anything but `SPEC_SQL`, or no NUL before `end`, marks the connection. */
  parse(body: i32, end: i32): void {
    let p: i32 = body;
    while (p < end && this.input[p] !== 0) {
      p += 1;
    }
    p += 1;
    const start: i32 = p;
    while (p < end && this.input[p] !== 0) {
      p += 1;
    }
    if (p >= end) {
      this.wrongQuery = true;
      return;
    }
    const query: u8[] = this.input.slice(start, p);
    const spec: u8[] = ascii(SPEC_SQL);
    let same: boolean = query.length === spec.length;
    for (let k: i32 = 0; same && k < toI32(spec.length); k++) {
      same = query[k] === spec[k];
    }
    if (!same) {
      this.wrongQuery = true;
    }
  }

  /** An ErrorResponse with `code`. */
  error(code: string, message: string): void {
    this.begin(69);
    this.byte(83);
    this.cstr("ERROR");
    this.byte(67);
    this.cstr(code);
    this.byte(77);
    this.cstr(message);
    this.byte(0);
    this.finish();
  }

  /** Bind's text parameters, past its portal and statement names and its format codes. */
  bind(body: i32): void {
    let p: i32 = body;
    for (let names: i32 = 0; names < 2; names++) {
      while (this.input[p] !== 0) {
        p += 1;
      }
      p += 1;
    }
    p += 2 + 2 * this.at16(p);
    const count: i32 = this.at16(p);
    p += 2;
    this.params = [];
    for (let k: i32 = 0; k < count; k++) {
      const len: i32 = this.at32(p);
      this.params.push(len < 0 ? -1 : this.number(p + 4, len));
      p += 4 + (len < 0 ? 0 : len);
    }
    this.bound = true;
  }

  /** The answers owed at a Sync, in the order the messages before it came. */
  sync(): void {
    if (this.wrongQuery && (this.parsed || this.described || this.bound)) {
      // The first error skips the rest of the group, as a server does up to the Sync.
      this.error("42601", "not the query HttpArena's spec states");
      this.ready();
      this.parsed = false;
      this.described = false;
      this.bound = false;
      return;
    }
    if (this.parsed) {
      this.begin(49);
      this.finish();
    }
    if (this.described) {
      this.begin(116);
      this.int16(3);
      for (let k: i32 = 0; k < 3; k++) {
        this.int32(20);
      }
      this.finish();
      this.begin(84);
      const names: string[] = columns();
      this.int16(toI32(names.length));
      for (let k: i32 = 0; k < toI32(names.length); k++) {
        this.cstr(names[k]);
        this.int32(16384);
        this.int16(k + 1);
        this.int32(TYPES[k]);
        this.int16(TYPES[k] === 16 ? 1 : -1);
        this.int32(-1);
        this.int16(0);
      }
      this.finish();
    }
    if (this.bound) {
      this.begin(50);
      this.finish();
      this.rows();
    }
    this.ready();
    this.parsed = false;
    this.described = false;
    this.bound = false;
  }

  /** The Execute's answer: the matching rows and their tag, or the 42P01 refusal. */
  rows(): void {
    const ok: boolean = toI32(this.params.length) === 3;
    const min: i32 = ok ? this.params[0] : -1;
    if (!ok || min === PG_REFUSED_MIN) {
      this.error("42P01", 'relation "items" does not exist');
      return;
    }
    let sent: i32 = 0;
    for (let k: i32 = 1; k <= PG_ROWS && sent < this.params[2]; k++) {
      if (10 * k >= min && 10 * k <= this.params[1]) {
        const cells: string[] = pgItem(k);
        this.begin(68);
        this.int16(toI32(cells.length));
        for (const cell of cells) {
          this.int32(toI32(cell.length));
          for (const b of ascii(cell)) {
            this.out.push(b);
          }
        }
        this.finish();
        sent += 1;
      }
    }
    this.begin(67);
    this.cstr(`SELECT ${sent}`);
    this.finish();
  }

  /** Answers every whole message `input` holds; false once the connection should close. */
  read(): boolean {
    let p: i32 = 0;
    while (true) {
      const left: i32 = toI32(this.input.length) - p;
      if (!this.started) {
        if (left < 4 || left < this.at32(p)) {
          break;
        }
        p += this.at32(p);
        this.started = true;
        this.begin(82);
        this.int32(0);
        this.finish();
        this.begin(83);
        this.cstr("client_encoding");
        this.cstr("UTF8");
        this.finish();
        this.begin(75);
        this.int32(4242);
        this.int32(99);
        this.finish();
        this.ready();
        continue;
      }
      if (left < 5 || left < 1 + this.at32(p + 1)) {
        break;
      }
      const type: i32 = toI32(this.input[p]);
      const body: i32 = p + 5;
      p += 1 + this.at32(p + 1);
      if (type === 80) {
        this.parsed = true;
        this.parse(body, p);
      } else if (type === 68) {
        this.described = true;
      } else if (type === 66) {
        this.bind(body);
      } else if (type === 83) {
        this.sync();
      } else if (type === 88) {
        return false;
      }
    }
    this.input = this.input.slice(p);
    return true;
  }

  /** Writes what is owed until the socket takes no more; false once it failed. */
  flush(): boolean {
    let sent: i32 = 0;
    while (sent < toI32(this.out.length)) {
      const w: i32 = netWrite(this.fd, this.out, sent, toI32(this.out.length) - sent);
      if (w === WOULD_BLOCK) {
        break;
      }
      if (w <= 0) {
        return false;
      }
      sent += w;
    }
    this.out = this.out.slice(sent);
    return true;
  }
}

/** `pg <udp port>`: serves until `IDLE_MS` pass with nothing to do, then exits 0. */
export const pgStandIn = (driver: i32): i32 => {
  const listen: i32 = tcpListen("127.0.0.1", ZERO, toI32(64));
  if (listen < 0) {
    return 1;
  }
  const loop: i32 = pollCreate();
  pollAdd(loop, listen, 1, ZERO);
  const tell: i32 = udpBind("127.0.0.1", ZERO, ZERO);
  const to: u8[] = new Array<u8>(18);
  netAddress(to, "127.0.0.1", driver);
  const hello: u8[] = ascii(`pg ${netLocalPort(listen)}`);
  udpSendTo(tell, hello, ZERO, toI32(hello.length), to, ZERO, ZERO);
  netClose(tell);
  const peers: PgPeer[] = [];
  const ready: i32[] = new Array<i32>(128);
  const buf: u8[] = new Array<u8>(65536);
  const addr: u8[] = new Array<u8>(18);
  // Every wake tries every socket: a few connections, so no event needs its token read.
  while (pollWait(loop, ready, IDLE_MS) > 0) {
    let fd: i32 = tcpAccept(listen, addr);
    while (fd >= 0) {
      pollAdd(loop, fd, 1, toI32(peers.length + 1));
      peers.push(new PgPeer(fd));
      fd = tcpAccept(listen, addr);
    }
    let k: i32 = 0;
    while (k < toI32(peers.length)) {
      const peer: PgPeer = peers[k];
      let open: boolean = true;
      let n: i32 = netRead(peer.fd, buf, ZERO, toI32(buf.length));
      while (n > 0 && open) {
        for (let i: i32 = 0; i < n; i++) {
          peer.input.push(buf[i]);
        }
        open = peer.read();
        n = netRead(peer.fd, buf, ZERO, toI32(buf.length));
      }
      if (n !== WOULD_BLOCK || !open || !peer.flush()) {
        netClose(peer.fd);
        peers[k] = peers[toI32(peers.length) - 1];
        peers.pop();
      } else {
        k++;
      }
    }
  }
  for (const peer of peers) {
    netClose(peer.fd);
  }
  netClose(loop);
  netClose(listen);
  return ZERO;
};

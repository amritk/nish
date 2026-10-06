// A Nish HTTP/1.1 server on `nish/net/http1-server` and its Nish clients, in
// one readiness loop over loopback. The server runs both carriers at once —
// `Http1Server` on plain TCP and `Http1TlsServer` on TLS, each on a listener
// of its own — and its program, `App`, is what a program built on them looks
// like: accept into a slot, re-arm each descriptor with the interest the
// carrier answers, take the connection's events and answer them, and close
// the slot when it is done. The client side is plain `nish:net` (and the TLS
// record layer for the TLS clients), with `ClientReader` reading responses as
// their bytes arrive. Every wait is bounded: five seconds without a wake is a
// failure, never a hang.
import { Secret, secret, wipe } from "nish:secret";
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
} from "nish:net";
import { HTTP1_CHUNKED, HTTP1_NO_BODY } from "nish/net/http1";
import {
  H1_AGAIN,
  H1_BODY,
  H1_DONE,
  H1_END,
  H1_ERROR,
  H1_NEED_MORE,
  H1_POOL_FULL,
  H1_REQUEST,
  H1_WANT_READ,
  H1_WANT_WRITE,
  H1_WRITE,
  H1_WS_MESSAGE,
  Http1Config,
  Http1Connection,
  Http1Server,
  Http1TlsServer,
} from "nish/net/http1-server";
import { TlsServerConfig } from "nish/net/tls";
import { TLS_RECORD_SIGN } from "nish/net/tls/record-server";
import { TLS_TCP_POOL_FULL } from "nish/net/tls-tcp";
import { leafPrivate, serverPrivate } from "../net_tls_common/server";
import { ZERO, ascii } from "../net_tls_record_common/bytes";
import { Peer } from "../net_tls_record_tcp/harness";

const WOULD_BLOCK: i32 = -11;
/** The plain listener's token, and the TLS one's; a plain slot's token is the slot, a TLS slot's `TLS_SLOTS + slot`. */
export const PLAIN_LISTENER: i32 = 1000;
export const TLS_LISTENER: i32 = 1001;
export const TLS_SLOTS: i32 = 500;
/** The first client's token; client `k` is `CLIENTS + k`. */
export const CLIENTS: i32 = 2000;

/** What `/big` sends: two mebibytes, a byte pattern a reader can check. */
export const BIG_SIZE: i32 = 2097152;

/** Byte `k` of `/big`'s body. */
export const bigByte = (k: i32): i32 => (k * 7 + 3) & 255;

/** Where one slot's exchange stands, for the program: kept per slot, made once. */
class SlotState {
  /** What the request asked for: 0 nothing more, 1 an echo, 2 `/big`, 3 a WebSocket echo, 4 a 204 once the body is in. */
  mode: i32 = 0;
  /** A write the connection held back: `pendingLength` bytes of the event's window from `pendingStart`. */
  pendingStart: i32 = 0;
  pendingLength: i32 = 0;
  /** `/big`'s bytes still to write. */
  bigLeft: i32 = 0;
  /** The request has ended, so the response ends once nothing is pending. */
  ended: boolean = false;
  /** A WebSocket frame was held back, and is `opcode`. */
  framePending: boolean = false;
  opcode: i32 = 0;

  reset(): void {
    this.mode = 0;
    this.pendingStart = 0;
    this.pendingLength = 0;
    this.bigLeft = 0;
    this.ended = false;
    this.framePending = false;
    this.opcode = 0;
  }
}

/**
 * The server's program. `/hello` answers a short body with a length (and
 * HEAD the same head, no body); `/echo` streams the request body back chunked
 * as it arrives, after a 100 Continue when the request expects one; `/big`
 * streams 2 MiB chunked through the output's back-pressure; `/sink` reads the
 * body and answers 204 only once it has ended; `/ws` accepts a
 * WebSocket and echoes every message; anything else is a 404. Nothing here
 * allocates per request: the fields, the bodies and the slot states are made
 * once.
 */
export class App {
  names: u8[][];
  values: u8[][];
  none: u8[][];
  hello: u8[];
  pattern: u8[];
  plainStates: SlotState[];
  tlsStates: SlotState[];
  /** The largest `H1_BODY` the program was handed, and how many requests it answered. */
  largestChunk: i32 = 0;
  requests: i32 = 0;
  /** The last WebSocket close status a slot reported, and the last H1_ERROR's. */
  closeStatus: i32 = 0;
  errorStatus: i32 = 0;

  constructor(slots: i32) {
    this.names = [ascii("Content-Type")];
    this.values = [ascii("text/plain")];
    this.none = [];
    this.hello = ascii("hello from nish/net/http1\n");
    this.pattern = new Array<u8>(16384);
    for (let k: i32 = 0; k < 16384; k++) {
      this.pattern[k] = toU8(bigByte(k));
    }
    this.plainStates = [];
    this.tlsStates = [];
    for (let k: i32 = 0; k < slots; k++) {
      this.plainStates.push(new SlotState());
      this.tlsStates.push(new SlotState());
    }
  }

  /** Answers `event` on `conn`, whose program state is `st`. */
  handle(conn: Http1Connection, event: i32, st: SlotState): void {
    if (event === H1_REQUEST) {
      st.reset();
      this.request(conn, st);
    } else if (event === H1_BODY) {
      if (conn.dataLength > this.largestChunk) {
        this.largestChunk = conn.dataLength;
      }
      if (st.mode === 1) {
        this.echo(conn, st, conn.dataStart, conn.dataLength);
      }
    } else if (event === H1_END) {
      st.ended = true;
      if (st.mode === 1 && st.pendingLength === 0) {
        conn.end();
      } else if (st.mode === 4) {
        conn.respond(toI32(204), this.none, this.none, HTTP1_NO_BODY);
        conn.end();
      }
    } else if (event === H1_WRITE) {
      this.resume(conn, st);
    } else if (event === H1_WS_MESSAGE) {
      st.opcode = conn.opcode;
      st.framePending = conn.sendFrame(true, conn.opcode, conn.data, conn.dataStart, conn.dataLength) === H1_AGAIN;
    } else if (event === H1_ERROR) {
      this.errorStatus = conn.status;
    } else {
      this.closeStatus = conn.status;
    }
  }

  /** A request's head: routes it. */
  request(conn: Http1Connection, st: SlotState): void {
    this.requests = this.requests + 1;
    const p = conn.parser;
    if (p.targetIs("/ws")) {
      if (conn.acceptWebSocket("") === 0) {
        st.mode = 3;
      } else {
        conn.respond(toI32(400), this.none, this.none, ZERO);
        conn.end();
      }
    } else if (p.targetIs("/hello")) {
      conn.respond(toI32(200), this.names, this.values, toI32(this.hello.length));
      conn.write(this.hello, ZERO, toI32(this.hello.length));
      conn.end();
    } else if (p.targetIs("/echo")) {
      if (p.headerIs("expect", "100-continue")) {
        conn.respond(toI32(100), this.none, this.none, HTTP1_NO_BODY);
      }
      conn.respond(toI32(200), this.names, this.values, HTTP1_CHUNKED);
      st.mode = 1;
    } else if (p.targetIs("/sink")) {
      st.mode = 4;
    } else if (p.targetIs("/big")) {
      conn.respond(toI32(200), this.names, this.values, HTTP1_CHUNKED);
      st.mode = 2;
      st.bigLeft = BIG_SIZE;
      this.pump(conn, st);
    } else {
      conn.respond(toI32(404), this.none, this.none, ZERO);
      conn.end();
    }
  }

  /** Writes `conn.data[start .. start + length)` back, keeping what did not fit for `H1_WRITE`. */
  echo(conn: Http1Connection, st: SlotState, start: i32, length: i32): void {
    const n: i32 = conn.write(conn.data, start, length);
    const taken: i32 = n > 0 ? n : 0;
    st.pendingStart = start + taken;
    st.pendingLength = length - taken;
  }

  /** Writes `/big` until the output is full or the body is all written. */
  pump(conn: Http1Connection, st: SlotState): void {
    while (st.bigLeft > 0) {
      // The pattern repeats every 256 bytes, so a write that took part of
      // its window resumes at the offset that keeps it in step.
      const from: i32 = (BIG_SIZE - st.bigLeft) & 255;
      const room: i32 = toI32(this.pattern.length) - from;
      const want: i32 = st.bigLeft < room ? st.bigLeft : room;
      const n: i32 = conn.write(this.pattern, from, want);
      if (n <= 0) {
        return;
      }
      st.bigLeft = st.bigLeft - n;
      if (n < want) {
        return;
      }
    }
    conn.end();
  }

  /** `H1_WRITE`: the held-back write goes again. */
  resume(conn: Http1Connection, st: SlotState): void {
    if (st.mode === 1) {
      if (st.pendingLength > 0) {
        this.echo(conn, st, st.pendingStart, st.pendingLength);
      }
      if (st.pendingLength === 0 && st.ended) {
        conn.end();
      }
    } else if (st.mode === 2) {
      this.pump(conn, st);
    } else if (st.mode === 3 && st.framePending) {
      st.framePending = conn.sendFrame(true, st.opcode, conn.data, conn.dataStart, conn.dataLength) === H1_AGAIN;
    }
  }
}

/** The loop, both servers, the program, its clients, and what happened. */
export class H1Loop {
  loop: i32 = -1;
  plainListener: i32 = -1;
  tlsListener: i32 = -1;
  plainPort: i32 = 0;
  tlsPort: i32 = 0;
  plain: Http1Server;
  secure: Http1TlsServer;
  app: App;
  ready: i32[];
  peers: Peer[];
  buf: u8[];
  keyBuffer: u8[];
  randomBuffer: u8[];
  /** The first thing that went wrong, or empty. */
  failure: string = "";
  accepted: i32 = 0;
  refused: i32 = 0;
  closed: i32 = 0;
  /** While set, how far the servers' calls and the program's answers moved the arena, summed. */
  measuring: boolean = false;
  growth: i64 = 0;
  /** Serve mode, for a third-party client: randomness from the system and a line for every connection closed. */
  serving: boolean = false;

  /** Both servers on loopback, each on `plainPort` and `tlsPort`, or on any free port for 0. */
  constructor(config: Http1Config, tls: TlsServerConfig, poolSize: i32, plainPort: i32, tlsPort: i32) {
    this.ready = new Array<i32>(64);
    this.peers = [];
    this.buf = new Array<u8>(65536);
    this.keyBuffer = new Array<u8>(32);
    this.randomBuffer = new Array<u8>(32);
    this.app = new App(poolSize);
    this.loop = pollCreate();
    this.plainListener = tcpListen("127.0.0.1", plainPort, 16);
    this.plainPort = netLocalPort(this.plainListener);
    this.tlsListener = tcpListen("127.0.0.1", tlsPort, 16);
    this.tlsPort = netLocalPort(this.tlsListener);
    this.plain = new Http1Server(config, this.plainListener, poolSize);
    this.secure = new Http1TlsServer(tls, config, this.tlsListener, poolSize);
    pollAdd(this.loop, this.plainListener, 1, PLAIN_LISTENER);
    pollAdd(this.loop, this.tlsListener, 1, TLS_LISTENER);
  }

  /** Notes the first failure only. */
  fail(what: string): void {
    if (this.failure === "") {
      this.failure = what;
    }
  }

  /** A new client of the plain server, or of the TLS one, connected through the loop; its index, or -1. */
  connect(tls: boolean): i32 {
    const addr: u8[] = new Array<u8>(18);
    netAddress(addr, "127.0.0.1", tls ? this.tlsPort : this.plainPort);
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
    return this.dispatch(n, token);
  }

  /** Runs the loop until nothing is ready for a millisecond: every byte sent so far has been read and answered. */
  settle(): void {
    let rounds: i32 = 0;
    while (rounds < 1000) {
      const n: i32 = pollWait(this.loop, this.ready, 1);
      if (n <= 0) {
        return;
      }
      this.dispatch(n, toI32(-1));
      rounds = rounds + 1;
    }
  }

  /** Handles `n` ready descriptors; true when `token` was among them. */
  dispatch(n: i32, token: i32): boolean {
    let seen: boolean = false;
    for (let i: i32 = 0; i < n; i++) {
      const who: i32 = this.ready[2 * i];
      const events: i32 = this.ready[2 * i + 1];
      if (who === token) {
        seen = true;
      }
      if (who === PLAIN_LISTENER) {
        this.acceptPlain();
      } else if (who === TLS_LISTENER) {
        this.acceptTls();
      } else if (who >= CLIENTS) {
        this.readPeer(who - CLIENTS);
      } else if (who >= TLS_SLOTS) {
        this.serveTls(who - TLS_SLOTS, events);
      } else {
        this.servePlain(who, events);
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

  /** Accepts every waiting plain connection. */
  acceptPlain(): void {
    while (true) {
      const slot: i32 = this.plain.accept();
      if (slot >= 0) {
        this.accepted = this.accepted + 1;
        pollAdd(this.loop, this.plain.fd(slot), H1_WANT_READ, slot);
      } else if (slot === H1_POOL_FULL) {
        this.refused = this.refused + 1;
      } else {
        return;
      }
    }
  }

  /** Accepts every waiting TLS connection. */
  acceptTls(): void {
    while (true) {
      const key: u8[] = serverPrivate();
      for (let k: i32 = 0; k < 32 && k < toI32(key.length); k++) {
        this.keyBuffer[k] = key[k];
        this.randomBuffer[k] = toU8(0x40 + this.accepted);
      }
      if (this.serving) {
        crypto.getRandomValues(this.randomBuffer);
        crypto.getRandomValues(this.keyBuffer);
      }
      const slot: i32 = this.secure.accept(this.randomBuffer, this.keyBuffer);
      if (slot >= 0) {
        this.accepted = this.accepted + 1;
        pollAdd(this.loop, this.secure.fd(slot), 1, TLS_SLOTS + slot);
      } else if (slot === TLS_TCP_POOL_FULL) {
        this.refused = this.refused + 1;
      } else {
        return;
      }
    }
  }

  /** A plain connection's descriptor is ready: drive it, answer its events, then re-arm it or close it. */
  servePlain(slot: i32, events: i32): void {
    if (!this.plain.holds(slot)) {
      return;
    }
    const before: i64 = Arena.used();
    let wants: i32 = (events & 5) !== 0 ? this.plain.readable(slot) : this.plain.writable(slot);
    const conn: Http1Connection = this.plain.connection(slot);
    const st: SlotState = this.app.plainStates[slot];
    let event: i32 = this.plain.next(slot);
    while (event !== H1_NEED_MORE) {
      this.app.handle(conn, event, st);
      if (event === H1_ERROR) {
        break;
      }
      event = this.plain.next(slot);
    }
    wants = this.plain.flush(slot);
    if (this.measuring) {
      this.growth = this.growth + (Arena.used() - before);
    }
    if ((wants & H1_DONE) !== 0) {
      if (this.serving) {
        console.log(`closed: plain requests ${this.app.requests}`);
      }
      this.plain.close(slot);
      this.closed = this.closed + 1;
      return;
    }
    pollModify(this.loop, this.plain.fd(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), slot);
  }

  /** A TLS connection's descriptor is ready: the same, with a signature when the handshake asks for one. */
  serveTls(slot: i32, events: i32): void {
    const before: i64 = Arena.used();
    let wants: i32 = (events & 5) !== 0 ? this.secure.readable(slot) : this.secure.writable(slot);
    if ((wants & TLS_RECORD_SIGN) !== 0) {
      const key: Secret<u8[]> = secret(leafPrivate());
      this.secure.signP256(slot, key);
      wipe(key);
    }
    const conn: Http1Connection = this.secure.connection(slot);
    const st: SlotState = this.app.tlsStates[slot];
    let event: i32 = this.secure.next(slot);
    while (event !== H1_NEED_MORE) {
      this.app.handle(conn, event, st);
      if (event === H1_ERROR) {
        break;
      }
      event = this.secure.next(slot);
    }
    wants = this.secure.flush(slot);
    if (this.measuring) {
      this.growth = this.growth + (Arena.used() - before);
    }
    if (!this.secure.holds(slot)) {
      return;
    }
    if ((wants & H1_DONE) !== 0) {
      if (this.serving) {
        const alpn: string = this.secure.alpn(slot) === "" ? "-" : this.secure.alpn(slot);
        console.log(`closed: tls alpn ${alpn} requests ${this.app.requests}`);
      }
      this.secure.close(slot);
      this.closed = this.closed + 1;
      return;
    }
    pollModify(this.loop, this.secure.fd(slot), wants & 3, TLS_SLOTS + slot);
  }

  /** Sends every byte of `bytes` from client `index`, running the loop while the socket is full. */
  send(index: i32, bytes: u8[]): void {
    this.sendRange(index, bytes, ZERO, toI32(bytes.length));
  }

  /** Sends `bytes[from .. to)` from client `index`. */
  sendRange(index: i32, bytes: u8[], from: i32, to: i32): void {
    const peer: Peer = this.peers[index];
    let sent: i32 = from;
    let rounds: i32 = 0;
    while (sent < to && rounds < 100000 && this.failure === "") {
      const w: i32 = netWrite(peer.fd, bytes, sent, to - sent);
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

  /** Runs the loop until client `index` holds at least `n` bytes, or its stream has ended; false on a timeout. */
  awaitBytes(index: i32, n: i32): boolean {
    const peer: Peer = this.peers[index];
    while (toI32(peer.got.length) < n && !peer.ended) {
      this.step(toI32(-1));
      if (this.failure !== "") {
        return false;
      }
    }
    return toI32(peer.got.length) >= n;
  }

  /** The next whole TLS record client `index` receives, header and all; empty on a timeout or the end of its stream. */
  nextRecord(index: i32): u8[] {
    const none: u8[] = [];
    if (!this.awaitBytes(index, toI32(5))) {
      return none;
    }
    const got: u8[] = this.peers[index].got;
    const length: i32 = (toI32(got[3]) << 8) | toI32(got[4]);
    if (!this.awaitBytes(index, 5 + length)) {
      return none;
    }
    return this.peers[index].take(5 + length);
  }

  /** Runs the loop until client `index`'s stream ends; false on a timeout. */
  awaitEnd(index: i32): boolean {
    const peer: Peer = this.peers[index];
    while (!peer.ended) {
      this.step(toI32(-1));
      if (this.failure !== "") {
        return false;
      }
    }
    return true;
  }

  /** Runs the loop until the servers have closed `count` connections in all. */
  awaitClosed(count: i32): boolean {
    while (this.closed < count) {
      this.step(toI32(-1));
      if (this.failure !== "") {
        return false;
      }
    }
    return true;
  }

  /** Reads one response for client `index` into `r`, running the loop as its bytes arrive; false on a timeout. */
  read(index: i32, r: ClientReader): boolean {
    const peer: Peer = this.peers[index];
    while (!r.advance(peer.got)) {
      if (peer.ended) {
        r.endOfStream(peer.got);
        return r.done;
      }
      this.step(toI32(-1));
      if (this.failure !== "") {
        return false;
      }
    }
    return true;
  }

  /** The next response for client `index`, read whole, its bytes taken off the client's input. */
  response(index: i32, head: boolean): ClientReader {
    const r = new ClientReader(head);
    if (this.read(index, r)) {
      this.peers[index].take(r.pos);
    }
    return r;
  }

  /** Closes client `index`'s socket without a word. */
  hangUp(index: i32): void {
    const peer: Peer = this.peers[index];
    if (peer.fd >= 0) {
      netClose(peer.fd);
      peer.fd = -1;
      peer.ended = true;
    }
  }

  /** Closes every socket the loop made. */
  shutdown(): void {
    for (let k: i32 = 0; k < toI32(this.peers.length); k++) {
      this.hangUp(k);
    }
    for (let slot: i32 = 0; slot < this.plain.size(); slot++) {
      this.plain.close(slot);
    }
    for (let slot: i32 = 0; slot < this.secure.size(); slot++) {
      this.secure.close(slot);
    }
    netClose(this.plainListener);
    netClose(this.tlsListener);
    netClose(this.loop);
  }
}

// What a `ClientReader` is waiting for.
const R_HEAD: i32 = 0;
const R_LENGTH: i32 = 1;
const R_CHUNK_SIZE: i32 = 2;
const R_CHUNK_DATA: i32 = 3;
const R_CHUNK_CRLF: i32 = 4;
const R_TRAILERS: i32 = 5;
const R_TO_CLOSE: i32 = 6;
const R_DONE: i32 = 7;

/**
 * One HTTP/1.1 response read from a client's input as it arrives: the head,
 * then a body by `Content-Length`, chunked, or to the end of the stream. It
 * resumes where it stopped, so a two-mebibyte body is read once, not once per
 * wake. It trusts the server's framing only as far as it can check it, and
 * marks anything it cannot read as `malformed`.
 */
export class ClientReader {
  /** The status line and fields, as text, CRLFs kept. */
  head: string = "";
  body: u8[];
  status: i32 = 0;
  /** Where the next unread byte of the input is; the bytes before it are this response's. */
  pos: i32 = 0;
  state: i32 = 0;
  left: i32 = 0;
  /** How many chunks the body came in. */
  chunks: i32 = 0;
  /** A response to HEAD: its head is all of it. */
  headOnly: boolean = false;
  done: boolean = false;
  malformed: boolean = false;
  /** Whether the body is kept, or only counted and checked against `/big`'s pattern. */
  keep: boolean = true;
  received: i32 = 0;
  patternMismatch: boolean = false;

  constructor(headOnly: boolean) {
    this.headOnly = headOnly;
    this.body = [];
  }

  /** The body as text. */
  text(): string {
    const parts: string[] = [];
    for (const b of this.body) {
      parts.push(String.fromCharCode(toI32(b)));
    }
    return parts.join("");
  }

  /** Whether the head holds `line` as one of its lines. */
  has(line: string): boolean {
    return toI32(this.head.indexOf(`\r\n${line}\r\n`)) >= 0;
  }

  /** Takes one body byte. */
  take(b: u8): void {
    if (this.keep) {
      this.body.push(b);
    } else if (toI32(b) !== bigByte(this.received)) {
      this.patternMismatch = true;
    }
    this.received = this.received + 1;
  }

  /** The end of the line starting at `from`, before its CRLF, or -1 when it has not all arrived. */
  lineEnd(got: u8[], from: i32): i32 {
    for (let k: i32 = from; k + 1 < toI32(got.length); k++) {
      if (got[k] === toU8(13) && got[k + 1] === toU8(10)) {
        return k;
      }
    }
    return -1;
  }

  /** Reads what it can of `got`; true once the response is complete. */
  advance(got: u8[]): boolean {
    while (!this.done && !this.malformed) {
      const n: i32 = toI32(got.length);
      if (this.state === R_HEAD) {
        let end: i32 = -1;
        for (let k: i32 = this.pos; k + 3 < n; k++) {
          if (got[k] === toU8(13) && got[k + 1] === toU8(10) && got[k + 2] === toU8(13) && got[k + 3] === toU8(10)) {
            end = k;
            break;
          }
        }
        if (end < 0) {
          return false;
        }
        const parts: string[] = [];
        const lowered: string[] = [];
        for (let k: i32 = this.pos; k < end + 2; k++) {
          const c: i32 = toI32(got[k]);
          parts.push(String.fromCharCode(c));
          lowered.push(String.fromCharCode(c >= 65 && c <= 90 ? c + 32 : c));
        }
        this.head = parts.join("");
        this.pos = end + 4;
        this.status = parseInt(this.head.substring(9, 12));
        const lower: string = lowered.join("");
        const at: i32 = toI32(lower.indexOf("\r\ncontent-length: "));
        if (this.headOnly || this.status < 200 || this.status === 204 || this.status === 304) {
          this.state = R_DONE;
        } else if (toI32(lower.indexOf("\r\ntransfer-encoding: chunked\r\n")) >= 0) {
          this.state = R_CHUNK_SIZE;
        } else if (at >= 0) {
          const rest: string = lower.substring(at + 18);
          this.left = parseInt(rest.substring(0, toI32(rest.indexOf("\r\n"))));
          this.state = this.left > 0 ? R_LENGTH : R_DONE;
        } else {
          this.state = R_TO_CLOSE;
        }
      } else if (this.state === R_LENGTH || this.state === R_CHUNK_DATA || this.state === R_TO_CLOSE) {
        if (this.pos >= n) {
          return false;
        }
        while (this.pos < n && (this.state === R_TO_CLOSE || this.left > 0)) {
          this.take(got[this.pos]);
          this.pos = this.pos + 1;
          this.left = this.left - 1;
        }
        if (this.state === R_LENGTH && this.left === 0) {
          this.state = R_DONE;
        } else if (this.state === R_CHUNK_DATA && this.left === 0) {
          this.state = R_CHUNK_CRLF;
        }
      } else if (this.state === R_CHUNK_SIZE || this.state === R_CHUNK_CRLF || this.state === R_TRAILERS) {
        const end: i32 = this.lineEnd(got, this.pos);
        if (end < 0) {
          return false;
        }
        if (this.state === R_CHUNK_CRLF) {
          this.malformed = end !== this.pos;
          this.state = R_CHUNK_SIZE;
        } else if (this.state === R_TRAILERS) {
          if (end === this.pos) {
            this.state = R_DONE;
          }
        } else {
          let size: i32 = 0;
          for (let k: i32 = this.pos; k < end; k++) {
            const c: i32 = toI32(got[k]);
            const digit: i32 = c >= 97 ? c - 87 : c - 48;
            size = size * 16 + digit;
          }
          this.malformed = end === this.pos;
          this.left = size;
          if (size === 0) {
            this.state = R_TRAILERS;
          } else {
            this.chunks = this.chunks + 1;
            this.state = R_CHUNK_DATA;
          }
        }
        this.pos = end + 2;
      } else {
        this.done = true;
      }
    }
    return this.done;
  }

  /** The stream ended: a body read to the close is complete; anything else was cut short. */
  endOfStream(got: u8[]): void {
    this.advance(got);
    if (this.state === R_TO_CLOSE) {
      this.done = true;
    }
  }
}

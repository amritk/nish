// `Http1Connection.sendBody` over loopback: one `Http1Server` slot and a
// plain `nish:net` client per exchange. Under a `Content-Length` response the
// queued output and the body leave in one `netWrite2`, so the output is empty
// once the call returns; under a send buffer too small for the body the
// socket takes part of it straight from the caller's bytes and only the rest
// is copied. Every exchange is run twice, once through `write` and once
// through `sendBody`, and the client must read the same bytes both times
// (the `Date` is pinned): the chunked, empty, compressed, held and socketless
// cases fall back to `write`'s copy. Every wait is bounded: two seconds
// without a wake is a failure.
import { DEFLATE_FAST } from "nish/compress/deflate";
import {
  NET_SO_SNDBUF,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netSetOption,
  netWrite,
  tcpConnect,
  tcpListen,
} from "nish:net";
import { HTTP_CODING_IDENTITY, HttpCompressor } from "nish/net/http-compress";
import { HTTP1_CHUNKED, HTTP1_NO_BODY } from "nish/net/http1-codec";
import {
  H1_AGAIN,
  H1_CLOSED,
  H1_DONE,
  H1_END,
  H1_INVALID,
  H1_NEED_MORE,
  H1_REQUEST,
  H1_WANT_WRITE,
  H1_WRITE,
  Http1Config,
  Http1Connection,
  Http1Server,
} from "nish/net/http1-server";
import { Suite } from "nish/testing";
import { ready } from "../net_write2/wait";

const PINNED_MS: i64 = 1792138314000;
/** The ways a body is handed over: `Http1Connection.write`, or `sendBody`. */
const WRITE: i32 = 0;
const SEND_BODY: i32 = 1;
const ZERO: i32 = 0;
const POLL_OUT: i32 = 2;

const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    out.push(toU8(text.charCodeAt(k)));
  }
  return out;
};

/** `n` bytes counting up from `seed`, so a byte out of place shows. */
const pattern = (n: i32, seed: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  for (let k: i32 = 0; k < n; k++) {
    out[k] = toU8((k * 7 + seed) & 255);
  }
  return out;
};

const same = (a: u8[], b: u8[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let k: i32 = 0; k < toI32(a.length); k++) {
    if (a[k] !== b[k]) {
      return false;
    }
  }
  return true;
};

/** Ends with `tail`. */
const endsWith = (a: u8[], end: i32, tail: u8[]): boolean => {
  const from: i32 = end - toI32(tail.length);
  if (from < 0) {
    return false;
  }
  for (let k: i32 = 0; k < toI32(tail.length); k++) {
    if (a[from + k] !== tail[k]) {
      return false;
    }
  }
  return true;
};

/** A listener, a client connected to it, and the server slot that accepted it. */
class Pair {
  listener: i32 = -1;
  client: i32 = -1;
  slot: i32 = -1;
  server: Http1Server;
  /** What the client has read. */
  heard: u8[];
  scratch: u8[];

  constructor(config: Http1Config) {
    this.listener = tcpListen("127.0.0.1", 0, 4);
    this.server = new Http1Server(config, this.listener, 1);
    this.server.date.pin(PINNED_MS);
    const addr: u8[] = new Array<u8>(18);
    netAddress(addr, "127.0.0.1", netLocalPort(this.listener));
    this.client = tcpConnect(addr);
    this.slot = ready(this.listener, 1) ? this.server.accept() : -1;
    ready(this.client, 2);
    this.heard = [];
    this.scratch = new Array<u8>(65536);
  }

  conn(): Http1Connection {
    return this.server.connection(this.slot);
  }

  /** Sends `text` from the client and lets the server read it. */
  ask(text: string): void {
    const bytes: u8[] = ascii(text);
    netWrite(this.client, bytes, ZERO, toI32(bytes.length));
    if (this.slot >= 0 && ready(this.server.fd(this.slot), 1)) {
      this.server.readable(this.slot);
    }
  }

  /** The server's events until `event`, or the first that is not it and asks for more; answers the last. */
  until(event: i32): i32 {
    let e: i32 = this.server.next(this.slot);
    while (e !== event && e !== H1_NEED_MORE && e >= 0) {
      e = this.server.next(this.slot);
    }
    return e;
  }

  /** Reads what the client has waiting; whether the stream has ended. */
  drain(): boolean {
    let n: i32 = netRead(this.client, this.scratch, ZERO, toI32(this.scratch.length));
    while (n > 0) {
      for (let k: i32 = 0; k < n; k++) {
        this.heard.push(this.scratch[k]);
      }
      n = netRead(this.client, this.scratch, ZERO, toI32(this.scratch.length));
    }
    return n === 0;
  }

  /** Steps and flushes the slot until its response is sent and the connection done, the client reading as it goes; closes everything. */
  finish(): boolean {
    let done: boolean = false;
    let ended: boolean = false;
    let spins: i32 = 0;
    while (!(done && ended) && spins < 100000) {
      spins = spins + 1;
      if (!done) {
        this.server.next(this.slot);
      }
      if (!done && (this.server.flush(this.slot) & H1_DONE) !== 0) {
        this.server.close(this.slot);
        done = true;
      }
      ended = this.drain();
      if (done && !ended && !ready(this.client, 1)) {
        break;
      }
    }
    netClose(this.client);
    netClose(this.listener);
    return done && ended;
  }
}

/** Hands `body[from .. from + n)` over the way `mode` names. */
const hand = (conn: Http1Connection, mode: i32, body: readonly u8[], from: i32, n: i32): i32 =>
  mode === SEND_BODY ? conn.sendBody(body, from, n) : conn.write(body, from, n);

/**
 * One `Connection: close` request answered `status` with `body` under
 * `framing` (its length, `HTTP1_CHUNKED` or `HTTP1_NO_BODY`), handed over by `mode` again on each `H1_WRITE`
 * until all of it is taken; answers what the client read. `sendBuffer` > 0
 * shrinks the server's send buffer and holds the client's reads until the
 * first hand-over has answered.
 */
class Exchange {
  heard: u8[];
  /** What the first hand-over answered, and whether output was left queued after it. */
  first: i32 = 0;
  queuedAfter: boolean = false;
  /** What a second hand-over straight after a short first answered (0 when the first took everything). */
  again: i32 = 0;
  completed: boolean = false;

  constructor(config: Http1Config, method: string, status: i32, framing: i32, body: readonly u8[], mode: i32, sendBuffer: i32) {
    const p = new Pair(config);
    p.ask(`${method} / HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n`);
    const conn = p.conn();
    const none: u8[][] = [];
    if (sendBuffer > 0) {
      netSetOption(p.server.fd(p.slot), NET_SO_SNDBUF, sendBuffer);
    }
    const total: i32 = toI32(body.length);
    let ok: boolean = p.until(H1_REQUEST) === H1_REQUEST && conn.respond(status, none, none, framing) === 0;
    let taken: i32 = hand(conn, mode, body, ZERO, total);
    this.first = taken;
    this.queuedAfter = conn.wantsWrite();
    if (taken < 0) {
      taken = 0;
    }
    if (taken < total) {
      this.again = hand(conn, mode, body, taken, total - taken);
    }
    let spins: i32 = 0;
    while (ok && taken < total && spins < 100000) {
      spins = spins + 1;
      p.drain();
      const e: i32 = p.server.next(p.slot);
      if (e === H1_WRITE) {
        const n: i32 = hand(conn, mode, body, taken, total - taken);
        if (n > 0) {
          taken = taken + n;
        }
      } else if (e !== H1_NEED_MORE && e !== H1_END) {
        ok = false;
      } else if ((p.server.flush(p.slot) & H1_WANT_WRITE) !== 0 && !ready(p.server.fd(p.slot), POLL_OUT)) {
        // Output is left: the socket takes more once the peer's reads free its buffer.
        ok = false;
      }
    }
    ok = ok && conn.end() === 0;
    this.completed = ok && p.finish();
    this.heard = p.heard;
  }
}

/** A connection with no socket fed `text`, its `Date` pinned, at its first request. */
const socketless = (text: string): Http1Connection => {
  const conn = new Http1Connection(new Http1Config());
  conn.date.pin(PINNED_MS);
  const bytes: u8[] = ascii(text);
  conn.feed(bytes, ZERO, toI32(bytes.length));
  conn.next();
  return conn;
};

const queued = (conn: Http1Connection): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = conn.outputStart; k < conn.outputEnd; k++) {
    out.push(conn.output[k]);
  }
  return out;
};

export const main = (): i32 => {
  const t = new Suite("http1 sendBody");
  const none: u8[][] = [];
  const config = new Http1Config();

  // A full send: the head and the body leave together, nothing is copied.
  const small: u8[] = pattern(3000, 1);
  const writeSmall = new Exchange(config, "GET", 200, 3000, small, WRITE, 0);
  const sendSmall = new Exchange(config, "GET", 200, 3000, small, SEND_BODY, 0);
  t.ok("write copies the body into the output", writeSmall.first === 3000 && writeSmall.queuedAfter);
  t.ok("sendBody sends the head and the body in one call, leaving nothing queued", sendSmall.first === 3000 && !sendSmall.queuedAfter);
  t.ok("both exchanges complete", writeSmall.completed && sendSmall.completed);
  t.ok("and the client reads the same bytes", same(writeSmall.heard, sendSmall.heard) && endsWith(sendSmall.heard, toI32(sendSmall.heard.length), small));

  // A partial send: a small send buffer and a client that reads only later.
  // The output holds 1024 bytes, so a first answer past that came from the
  // body itself; the rest goes through `H1_WRITE` as `write`'s does.
  const tight = new Http1Config();
  tight.outputSize = 1024;
  const big: u8[] = pattern(4194304, 3);
  const writeBig = new Exchange(tight, "GET", 200, 4194304, big, WRITE, 4096);
  const sendBig = new Exchange(tight, "GET", 200, 4194304, big, SEND_BODY, 4096);
  t.ok("under a small send buffer sendBody answers short", sendBig.first > 0 && sendBig.first < 4194304);
  t.ok("having sent more than the output could hold", sendBig.first > tight.outputSize);
  t.ok("write answers no more than the output holds", writeBig.first > 0 && writeBig.first < tight.outputSize);
  t.eqI32("a sendBody behind the held write copies as write does: no room yet", sendBig.again, H1_AGAIN);
  t.eqI32("as write's own second call answers", writeBig.again, H1_AGAIN);
  t.ok("both 4 MiB exchanges complete", writeBig.completed && sendBig.completed);
  t.ok("and the client reads the same bytes", same(writeBig.heard, sendBig.heard) && endsWith(sendBig.heard, toI32(sendBig.heard.length), big));

  // The fallbacks: a chunked body, and a HEAD whose body is dropped.
  const writeChunked = new Exchange(config, "GET", 200, HTTP1_CHUNKED, small, WRITE, 0);
  const sendChunked = new Exchange(config, "GET", 200, HTTP1_CHUNKED, small, SEND_BODY, 0);
  t.ok("a chunked sendBody copies as write does", sendChunked.first === 3000 && sendChunked.queuedAfter);
  t.ok("with the same bytes on the wire", sendChunked.completed && same(writeChunked.heard, sendChunked.heard));
  const writeHead = new Exchange(config, "HEAD", 200, 3000, small, WRITE, 0);
  const sendHead = new Exchange(config, "HEAD", 200, 3000, small, SEND_BODY, 0);
  t.ok("a HEAD's sendBody takes everything and sends nothing", sendHead.first === 3000);
  t.ok("with the same bytes on the wire", sendHead.completed && same(writeHead.heard, sendHead.heard));
  const writeNoContent = new Exchange(config, "GET", 204, HTTP1_NO_BODY, small, WRITE, 0);
  const sendNoContent = new Exchange(config, "GET", 204, HTTP1_NO_BODY, small, SEND_BODY, 0);
  t.ok("a 204's sendBody takes everything and sends nothing", sendNoContent.first === 3000 && writeNoContent.first === 3000);
  t.ok("with the same bytes on the wire, and no body", sendNoContent.completed && same(writeNoContent.heard, sendNoContent.heard) && !endsWith(sendNoContent.heard, toI32(sendNoContent.heard.length), small));

  // A `readonly u8[]` (a ring's `peek`, say) is handed over as it is: a full
  // send, and the chunked fallback through `write`'s copy.
  const frozen: readonly u8[] = small;
  const sendFrozen = new Exchange(config, "GET", 200, 3000, frozen, SEND_BODY, 0);
  t.ok("a readonly body is sent whole, nothing queued", sendFrozen.first === 3000 && !sendFrozen.queuedAfter);
  t.ok("with the bytes write sends", sendFrozen.completed && same(writeSmall.heard, sendFrozen.heard));
  const sendFrozenChunked = new Exchange(config, "GET", 200, HTTP1_CHUNKED, frozen, SEND_BODY, 0);
  t.ok("a readonly chunked body is copied as write copies it", sendFrozenChunked.first === 3000 && sendFrozenChunked.queuedAfter);
  t.ok("with the same bytes on the wire", sendFrozenChunked.completed && same(writeChunked.heard, sendFrozenChunked.heard));

  // A pipelined response already queued: the second response's head and its
  // body go out behind it, in order, in the same call.
  const two: string = "GET /a HTTP/1.1\r\nHost: a\r\n\r\nGET /b HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n";
  const first: u8[] = pattern(500, 5);
  const second: u8[] = pattern(700, 9);
  const heardPipelined: u8[][] = [];
  const pipelinedOk: boolean[] = [];
  const queuedBefore: boolean[] = [];
  const queuedAfterSecond: boolean[] = [];
  for (let mode: i32 = 0; mode < 2; mode++) {
    const p = new Pair(config);
    p.ask(two);
    const conn = p.conn();
    let ok: boolean = p.until(H1_REQUEST) === H1_REQUEST;
    ok = ok && conn.respond(200, none, none, 500) === 0 && conn.write(first, ZERO, 500) === 500 && conn.end() === 0;
    ok = ok && p.until(H1_REQUEST) === H1_REQUEST && conn.respond(200, none, none, 700) === 0;
    queuedBefore.push(conn.wantsWrite());
    ok = ok && hand(conn, mode, second, ZERO, 700) === 700;
    queuedAfterSecond.push(conn.wantsWrite());
    ok = ok && conn.end() === 0;
    pipelinedOk.push(p.finish() && ok);
    heardPipelined.push(p.heard);
  }
  t.ok("the first response is queued when the second's body is handed over", queuedBefore[0] && queuedBefore[1]);
  t.ok("sendBody sends it, the second head and the body together", !queuedAfterSecond[1] && queuedAfterSecond[0]);
  t.ok("both pipelined exchanges complete", pipelinedOk[0] && pipelinedOk[1]);
  t.ok("and the client reads the same bytes, in order", same(heardPipelined[0], heardPipelined[1]));

  // A compressed response is whole once `respondEncoded` returns, so a body
  // after it is refused alike, and both send the same compressed response.
  const heardEncoded: u8[][] = [];
  const encodedOk: boolean[] = [];
  for (let mode: i32 = 0; mode < 2; mode++) {
    const p = new Pair(config);
    p.ask("GET / HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n");
    const conn = p.conn();
    const enc = new HttpCompressor(DEFLATE_FAST, 256, 65536);
    p.until(H1_REQUEST);
    const encoded: i32 = conn.respondEncoded(200, none, none, small, ZERO, 3000, enc, HTTP_CODING_IDENTITY);
    t.ok(`after respondEncoded, mode ${mode} answers H1_CLOSED`, encoded === 0 && hand(conn, mode, small, ZERO, 10) === H1_CLOSED);
    encodedOk.push(p.finish());
    heardEncoded.push(p.heard);
  }
  t.ok("the compressed responses complete with the same bytes on the wire", encodedOk[0] && encodedOk[1] && heardEncoded[0].length > 0 && same(heardEncoded[0], heardEncoded[1]));

  // More than the response owes, and no body at all.
  const p = new Pair(config);
  p.ask("GET / HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n");
  const conn = p.conn();
  p.until(H1_REQUEST);
  conn.respond(200, none, none, 10);
  t.eqI32("a body past the length is H1_INVALID, as write's", conn.sendBody(small, ZERO, 11), H1_INVALID);
  t.eqI32("and write's", conn.write(small, ZERO, 11), H1_INVALID);
  t.eqI32("an empty body takes nothing", conn.sendBody(small, ZERO, 0), 0);
  t.ok("and leaves the head queued", conn.wantsWrite());
  t.eqI32("the length in two calls: the first", conn.sendBody(small, ZERO, 4), 4);
  t.eqI32("the second", conn.sendBody(small, 4, 6), 6);
  t.ok("that response completes", conn.end() === 0 && p.finish() && endsWith(p.heard, toI32(p.heard.length), pattern(10, 1)));

  // A socket that would block before anything goes: all of it is copied.
  const full = new Pair(config);
  full.ask("GET / HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n");
  const fullConn = full.conn();
  const fd: i32 = full.server.fd(full.slot);
  netSetOption(fd, NET_SO_SNDBUF, 4096);
  const junk: u8[] = new Array<u8>(65536);
  let stuffed: i32 = 1;
  while (stuffed > 0) {
    stuffed = netWrite(fd, junk, ZERO, toI32(junk.length));
  }
  full.until(H1_REQUEST);
  fullConn.respond(200, none, none, 100);
  const blocked: u8[] = pattern(100, 11);
  t.ok("the socket is full", stuffed === H1_AGAIN);
  t.eqI32("a sendBody into it takes the body all the same", fullConn.sendBody(blocked, ZERO, 100), 100);
  t.ok("by copying it behind the head, nothing held", fullConn.wantsWrite() && !fullConn.writeHeld && endsWith(queued(fullConn), toI32(queued(fullConn).length), blocked));
  full.server.close(full.slot);
  netClose(full.client);
  netClose(full.listener);

  // A peer gone mid-body: the send fails, the connection is aborted.
  const gone = new Pair(config);
  gone.ask("GET / HTTP/1.1\r\nHost: a\r\n\r\n");
  const goneConn = gone.conn();
  gone.until(H1_REQUEST);
  goneConn.respond(200, none, none, 2);
  t.eqI32("the first byte is sent", goneConn.sendBody(small, ZERO, 1), 1);
  // The client closes with that response unread, which resets the connection.
  ready(gone.client, 1);
  netClose(gone.client);
  ready(gone.server.fd(gone.slot), 1);
  t.eqI32("the second, to a reset peer, is H1_CLOSED", goneConn.sendBody(small, 1, 1), H1_CLOSED);
  t.ok("and the connection is aborted and done", goneConn.isDone() && goneConn.fd === -1);
  t.eqI32("a sendBody after it is H1_CLOSED", goneConn.sendBody(small, 1, 1), H1_CLOSED);
  gone.server.close(gone.slot);
  netClose(gone.listener);

  // A held write whose output a `flush` empties: the peer reads between `next`
  // and `flush`, so `next` finds no room and `flush` sends everything. The
  // write is still held and a held write reads nothing, so `flush` must ask
  // for the write bit, or the slot is armed for nothing and `H1_WRITE` never
  // comes (examples/file-server.ts hung on a 64 MiB file this way).
  const held = new Pair(config);
  held.ask("GET / HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n");
  const heldConn = held.conn();
  const heldFd: i32 = held.server.fd(held.slot);
  let filled: i32 = 1;
  while (filled > 0) {
    filled = netWrite(heldFd, junk, ZERO, toI32(junk.length));
  }
  held.until(H1_REQUEST);
  heldConn.respond(200, none, none, 4194304);
  const heldTook: i32 = heldConn.write(big, ZERO, 4194304);
  t.ok("a write into a full socket is taken short and held", heldTook > 0 && heldTook < 4194304 && heldConn.writeHeld);
  t.eqI32("next finds the socket full and waits", held.server.next(held.slot), H1_NEED_MORE);
  let heldWants: i32 = 0;
  let tries: i32 = 0;
  while (tries === 0 || (heldConn.wantsWrite() && tries < 64)) {
    tries = tries + 1;
    held.drain();
    ready(held.client, 1);
    held.drain();
    heldWants = held.server.flush(held.slot);
  }
  t.ok("the peer reads, and flush empties the output with the write still held", !heldConn.wantsWrite() && heldConn.writeHeld);
  t.eqI32("flush answers the write bit for it", heldWants & H1_WANT_WRITE, H1_WANT_WRITE);
  t.eqI32("and on the writable socket next answers H1_WRITE", held.server.next(held.slot), H1_WRITE);
  held.server.close(held.slot);
  netClose(held.client);
  netClose(held.listener);

  // No socket (a sans-IO carrier, or Http1TlsServer's): `write` exactly.
  const get: string = "GET / HTTP/1.1\r\nHost: a\r\n\r\n";
  const viaWrite = socketless(get);
  const viaSend = socketless(get);
  viaWrite.respond(200, none, none, 3000);
  viaSend.respond(200, none, none, 3000);
  t.ok("a connection with no socket has fd -1", viaSend.fd === -1);
  t.ok("its sendBody copies as write does", viaWrite.write(small, ZERO, 3000) === 3000 && viaSend.sendBody(small, ZERO, 3000) === 3000);
  t.ok("the same bytes queued", same(queued(viaWrite), queued(viaSend)));
  return t.done();
};

// A `Content-Length` response finished without `end()`: one `Http1Server`
// slot and a plain `nish:net` client sending two requests on one keep-alive
// connection. A response whose length `write` or `sendBody` has met, or that
// has no body at all, is over when the connection looks for the next
// request, so the second request is answered; a body one byte short, a
// chunked body, and an unframed one to HTTP/1.0 still wait for `end()`. Every wait is bounded: two seconds
// without a wake is a failure, and the `Date` is pinned so that wire bytes
// can be compared.
import { netAddress, netClose, netLocalPort, netRead, netWrite, tcpConnect, tcpListen } from "nish:net";
import { HTTP1_CHUNKED, HTTP1_NO_BODY } from "nish/net/http1-codec";
import {
  H1_CLOSED,
  H1_DONE,
  H1_END,
  H1_INVALID,
  H1_NEED_MORE,
  H1_REQUEST,
  Http1Config,
  Http1Connection,
  Http1Server,
} from "nish/net/http1-server";
import { Suite } from "nish/testing";
import { ready } from "../net_write2/wait";

const PINNED_MS: i64 = 1792138314000;
const ZERO: i32 = 0;
/** How the first response's body is handed over. */
const SEND_BODY: i32 = 0;
const WRITE_TWICE: i32 = 1;
const NOTHING: i32 = 2;

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

/** Where `needle` first occurs in `hay` at or after `from`, or -1. */
const find = (hay: u8[], needle: u8[], from: i32): i32 => {
  const last: i32 = toI32(hay.length) - toI32(needle.length);
  for (let at: i32 = from; at <= last; at++) {
    let k: i32 = 0;
    while (k < toI32(needle.length) && hay[at + k] === needle[k]) {
      k = k + 1;
    }
    if (k === toI32(needle.length)) {
      return at;
    }
  }
  return -1;
};

/** How many times `needle` occurs in `hay`. */
const count = (hay: u8[], needle: u8[]): i32 => {
  let n: i32 = 0;
  let at: i32 = find(hay, needle, ZERO);
  while (at >= 0) {
    n = n + 1;
    at = find(hay, needle, at + 1);
  }
  return n;
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

  /** Whether the server accepted the client; a case whose pair is not up fails without touching the slot. */
  up(): boolean {
    return this.slot >= 0;
  }

  conn(): Http1Connection {
    return this.server.connection(this.slot);
  }

  /** Sends `text` from the client and lets the server read it. */
  ask(text: string): void {
    const bytes: u8[] = ascii(text);
    netWrite(this.client, bytes, ZERO, toI32(bytes.length));
    if (this.up() && ready(this.server.fd(this.slot), 1)) {
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

  /** Sends what the server has queued and reads until the client holds `responses` status lines, or the bound runs out. */
  hear(responses: i32): boolean {
    const status: u8[] = ascii("HTTP/1.1 ");
    this.server.flush(this.slot);
    this.drain();
    while (count(this.heard, status) < responses && ready(this.client, 1)) {
      this.server.flush(this.slot);
      this.drain();
    }
    return count(this.heard, status) >= responses;
  }

  /** Steps and flushes the slot until the connection is done and the client has read to the close; closes everything. */
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
    this.close();
    return done && ended;
  }

  /** Closes the slot, the client and the listener. */
  close(): void {
    if (this.up() && this.server.holds(this.slot)) {
      this.server.close(this.slot);
    }
    netClose(this.client);
    netClose(this.listener);
  }
}

const KEEP: string = "GET /a HTTP/1.1\r\nHost: a\r\n\r\n";
const LAST: string = "GET /b HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n";
/** The two responses' bodies. */
const firstBody = (): u8[] => pattern(3000, 1);
const secondBody = (): u8[] => pattern(700, 9);

/**
 * Two requests on one keep-alive connection, the second `Connection: close`
 * and sent only once the first response is read (or with the first, when
 * `pipelined`). The first is answered with `length` bytes of `first` handed
 * over by `mode` with `status`, `end()` only when `callEnd`; the second
 * with `second` by `write` and no `end()`.
 */
class TwoRequests {
  /** Whether the second request reached the program, and the exchange closed cleanly after it. */
  answered: boolean = false;
  completed: boolean = false;
  /** What `end()` on the first response answered (0 when not called). */
  ended: i32 = 0;
  heard: u8[];

  constructor(method: string, status: i32, length: i32, mode: i32, callEnd: boolean, pipelined: boolean) {
    this.heard = [];
    const p = new Pair(new Http1Config());
    if (p.up()) {
      this.run(p, method, status, length, mode, callEnd, pipelined);
    } else {
      p.close();
    }
    this.heard = p.heard;
  }

  private run(p: Pair, method: string, status: i32, length: i32, mode: i32, callEnd: boolean, pipelined: boolean): void {
    const none: u8[][] = [];
    const first: u8[] = firstBody();
    const second: u8[] = secondBody();
    const head: string = `${method} /a HTTP/1.1\r\nHost: a\r\n\r\n`;
    p.ask(pipelined ? head + LAST : head);
    const conn = p.conn();
    let ok: boolean = p.until(H1_REQUEST) === H1_REQUEST && conn.respond(status, none, none, length) === 0;
    if (mode === SEND_BODY) {
      ok = ok && conn.sendBody(first, ZERO, length) === length;
    } else if (mode === WRITE_TWICE) {
      const half: i32 = length / 2;
      ok = ok && conn.write(first, ZERO, half) === half && conn.write(first, half, length - half) === length - half;
    }
    if (callEnd) {
      this.ended = conn.end();
    }
    ok = ok && p.until(H1_END) === H1_END;
    if (!pipelined) {
      ok = ok && p.hear(1);
      p.ask(LAST);
    }
    this.answered = ok && p.until(H1_REQUEST) === H1_REQUEST;
    if (this.answered) {
      this.answered = conn.parser.targetIs("/b") && conn.respond(200, none, none, 700) === 0 && conn.write(second, ZERO, 700) === 700;
      this.completed = this.answered && p.finish();
    } else {
      p.close();
    }
  }
}

/** A first response that does not finish without `end()`: what the client and the program see. */
class Stalled {
  /** What `next` answered for the second request. */
  event: i32 = 0;
  /** What `end()` answered once the stall was seen. */
  ended: i32 = 0;
  /** Whether a second status line reached the client within the bound. */
  secondHeard: boolean = false;
  heard: u8[];

  constructor(length: i32, sent: i32) {
    this.heard = [];
    const p = new Pair(new Http1Config());
    if (p.up()) {
      this.run(p, length, sent);
    }
    this.heard = p.heard;
    p.close();
  }

  private run(p: Pair, length: i32, sent: i32): void {
    const none: u8[][] = [];
    const first: u8[] = firstBody();
    p.ask(KEEP);
    const conn = p.conn();
    p.until(H1_REQUEST);
    conn.respond(200, none, none, length);
    conn.sendBody(first, ZERO, sent);
    p.until(H1_END);
    p.hear(1);
    p.ask(LAST);
    this.event = p.until(H1_REQUEST);
    this.secondHeard = p.hear(2);
    this.ended = conn.end();
  }
}

/**
 * A chunked response to an HTTP/1.0 keep-alive request, sent unframed: with
 * no length and no last chunk, nothing but `end()` says it is over, so the
 * connection stays open until then.
 */
class Unframed {
  /** Whether the connection stayed open, unfinished, while `end()` was owed. */
  held: boolean = false;
  /** What `end()` answered, and whether the connection then closed cleanly. */
  ended: i32 = 0;
  completed: boolean = false;
  heard: u8[];

  constructor() {
    this.heard = [];
    const p = new Pair(new Http1Config());
    if (p.up()) {
      this.run(p);
    } else {
      p.close();
    }
    this.heard = p.heard;
  }

  private run(p: Pair): void {
    const none: u8[][] = [];
    const first: u8[] = firstBody();
    p.ask("GET /a HTTP/1.0\r\nConnection: keep-alive\r\n\r\n");
    const conn = p.conn();
    let ok: boolean = p.until(H1_REQUEST) === H1_REQUEST && conn.respond(200, none, none, HTTP1_CHUNKED) === 0;
    ok = ok && conn.sendBody(first, ZERO, 3000) === 3000 && p.until(H1_END) === H1_END;
    // The body goes out; the connection neither finishes nor closes.
    const done: boolean = (p.server.flush(p.slot) & H1_DONE) !== 0;
    let eof: boolean = p.drain();
    while (!eof && ready(p.client, 1)) {
      p.server.next(p.slot);
      p.server.flush(p.slot);
      eof = p.drain();
    }
    this.held = ok && !done && !eof && find(p.heard, first, ZERO) >= 0;
    this.ended = conn.end();
    this.completed = p.finish();
  }
}

export const main = (): i32 => {
  const t = new Suite("http1 implicit end");
  const none: u8[][] = [];
  const first: u8[] = firstBody();
  const second: u8[] = secondBody();

  const viaSend = new TwoRequests("GET", 200, 3000, SEND_BODY, false, false);
  t.ok("a full body through sendBody, no end: the second request is answered", viaSend.answered);
  t.ok("and both responses reach the client", viaSend.completed && count(viaSend.heard, ascii("HTTP/1.1 200")) === 2);

  const viaWrite = new TwoRequests("GET", 200, 3000, WRITE_TWICE, false, false);
  t.ok("a full body in two writes, no end: the second request is answered", viaWrite.answered && viaWrite.completed);
  t.ok("with the bytes sendBody sent", same(viaWrite.heard, viaSend.heard));

  const empty = new TwoRequests("GET", 200, 0, NOTHING, false, false);
  t.ok("Content-Length 0, no write, no end: the second request is answered", empty.answered && empty.completed);
  t.ok("and the first response has an empty body", find(empty.heard, ascii("Content-Length: 0\r\n"), ZERO) >= 0);

  const head = new TwoRequests("HEAD", 200, 3000, SEND_BODY, false, false);
  t.ok("a HEAD with its body swallowed, no end: the second request is answered", head.answered && head.completed);
  t.ok("and no body went out for it", find(head.heard, first, ZERO) < 0 && find(head.heard, second, ZERO) >= 0);

  const noContent = new TwoRequests("GET", 204, HTTP1_NO_BODY, NOTHING, false, false);
  t.ok("a 204, no end: the second request is answered", noContent.answered && noContent.completed);
  t.ok("and the 204 went out with no body framing", find(noContent.heard, ascii("HTTP/1.1 204"), ZERO) >= 0 && find(noContent.heard, ascii("Transfer-Encoding"), ZERO) < 0);

  const pipelined = new TwoRequests("GET", 200, 3000, SEND_BODY, false, true);
  t.ok("a pipelined second request is answered after a first with no end", pipelined.answered && pipelined.completed);
  const at: i32 = find(pipelined.heard, first, ZERO);
  t.ok("in order", at >= 0 && find(pipelined.heard, second, at) > at);
  t.ok("with the bytes the unpipelined exchange sent", same(pipelined.heard, viaSend.heard));

  const withEnd = new TwoRequests("GET", 200, 3000, WRITE_TWICE, true, false);
  t.eqI32("end() after the full body still answers 0", withEnd.ended, 0);
  t.ok("and the wire bytes are those without it", withEnd.completed && same(withEnd.heard, viaWrite.heard));
  const emptyEnd = new TwoRequests("GET", 200, 0, NOTHING, true, false);
  t.ok("end() on Content-Length 0 answers 0, same bytes", emptyEnd.ended === 0 && emptyEnd.completed && same(emptyEnd.heard, empty.heard));

  const short = new Stalled(3000, 2999);
  t.eqI32("a body one byte short, no end: the second request is not read", short.event, H1_NEED_MORE);
  t.ok("nor answered", !short.secondHeard);
  t.eqI32("and end() still answers H1_INVALID", short.ended, H1_INVALID);

  const chunked = new Stalled(HTTP1_CHUNKED, 3000);
  t.eqI32("a chunked body, no end: the second request is not read", chunked.event, H1_NEED_MORE);
  t.ok("nor answered, and no last chunk went out", !chunked.secondHeard && find(chunked.heard, ascii("\r\n0\r\n\r\n"), ZERO) < 0);
  t.eqI32("end() still writes the last chunk and answers 0", chunked.ended, 0);

  const unframed = new Unframed();
  t.ok("a chunked body to HTTP/1.0, no end: sent unframed, the connection stays open", unframed.held);
  t.ok("and end() answers 0 and closes it", unframed.ended === 0 && unframed.completed);

  // `end()` called once the connection has moved on answers as a second `end()` does.
  const late = new Pair(new Http1Config());
  let moved: boolean = false;
  let lateEnd: i32 = 0;
  if (late.up()) {
    late.ask(KEEP + LAST);
    const conn = late.conn();
    late.until(H1_REQUEST);
    conn.respond(200, none, none, 10);
    conn.write(first, ZERO, 10);
    moved = late.until(H1_REQUEST) === H1_REQUEST && conn.parser.targetIs("/b");
    lateEnd = conn.end();
  }
  t.ok("the next request starts without end", moved);
  t.eqI32("and an end() for the first response then has none under way", lateEnd, H1_CLOSED);
  late.close();
  return t.done();
};

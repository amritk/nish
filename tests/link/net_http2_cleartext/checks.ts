// `nish/net/http2-cleartext` over loopback: Nish clients that send raw HTTP/2
// frames over plain TCP, with no TLS and no Upgrade, against the carrier in
// one readiness loop.
//
//   1. Prior knowledge: the preface, SETTINGS and a GET answered with its
//      body, a POST whose body is echoed back, then a hundred GETs on one
//      connection with the server's calls moving the arena not at all and,
//      once they are answered, no frame buffer lent.
//   2. The preface: an HTTP/1.1 request line, an `Upgrade: h2c` request and a
//      preface wrong in its eleventh byte are each closed at the first byte
//      that differs, with nothing written; ten right bytes and a hang-up free
//      the slot; ten right bytes and silence are closed by `prefaceTimeout`;
//      clients mid-preface fill the pool and the next is shed. None of it
//      borrows a frame buffer. A preface split after its 1st, 10th or 23rd
//      byte is held and answered as one; `expire` past the deadline then
//      closes a slot mid-preface beside it and spares the prefaced one, which
//      still answers.
//   3. Slots: a free slot answers H2_ERROR and done; a server of 1,024 slots
//      and no connection has made no frame buffer.
//
// A third-party client drives the same server in `serve` mode (`main.ts`).
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame";
import { H2_ERROR, Http2Config } from "nish/net/http2";
import { H2C_DONE, Http2CleartextServer } from "nish/net/http2-cleartext";
import { httpFieldBytes } from "nish/net/http-fields";
import { netClose, tcpListen } from "nish:net";
import { Suite } from "nish/testing";
import { ZERO } from "../net_tls_record_common/bytes";
import { FrameLog, PREFACE, Wire } from "../net_http2/peer";
import { H2cLoop } from "./harness";

/** A GET of `path` over cleartext: `:scheme` is `http`. */
const plainGet = (path: string): string[] => [":method", "GET", ":scheme", "http", ":path", path, ":authority", "localhost"];

/** A POST of `path` with `content-length: length`, over cleartext. */
const plainPost = (path: string, length: i32): string[] => [":method", "POST", ":scheme", "http", ":path", path, ":authority", "localhost", "content-length", `${length}`];

/** One client: its socket in the loop and the HTTP/2 frames it has read. */
class H2cClient {
  lb: H2cLoop;
  index: i32 = -1;
  wire: Wire;
  log: FrameLog;

  constructor(lb: H2cLoop) {
    this.lb = lb;
    this.index = lb.connect();
    this.wire = new Wire();
    this.log = new FrameLog();
  }

  /** Sends what `wire` holds. */
  flush(): void {
    this.lb.send(this.index, this.wire.take());
  }

  /** Sends what `wire` holds in two writes, the first of `at` bytes, with ten milliseconds of the loop between. */
  flushSplit(at: i32): void {
    const bytes: u8[] = this.wire.take();
    const head: u8[] = [];
    const tail: u8[] = [];
    for (let k: i32 = 0; k < toI32(bytes.length); k++) {
      if (k < at) {
        head.push(bytes[k]);
      } else {
        tail.push(bytes[k]);
      }
    }
    this.lb.send(this.index, head);
    this.lb.wait(toI32(10));
    this.lb.send(this.index, tail);
  }

  /** Sends `text`, one byte a character. */
  sendText(text: string): void {
    this.lb.send(this.index, httpFieldBytes(text));
  }

  /** Reads until the log holds `n` frames or the stream ends; answers the frames joined. */
  awaitFrames(n: i32): string {
    while (toI32(this.log.frames.length) < n) {
      if (!this.lb.awaitBytes(this.index, toI32(1))) {
        break;
      }
      const got: u8[] = this.lb.peers[this.index].got;
      const bytes: u8[] = this.lb.peers[this.index].take(toI32(got.length));
      this.log.push(bytes, ZERO, toI32(bytes.length));
    }
    const frames: string[] = this.log.frames;
    this.log.frames = [];
    return frames.join("; ");
  }

  /** The preface, an empty SETTINGS and the acknowledgement of the server's. */
  prefaces(): void {
    const ids: i32[] = [];
    const values: i64[] = [];
    this.wire.preface();
    this.wire.settings(ids, values);
    this.wire.settingsAck();
  }

  /** Whether the server ended the stream having written nothing to it. */
  shutOut(): boolean {
    return this.lb.awaitEnd(this.index) && toI32(this.lb.peers[this.index].got.length) === 0;
  }
}

/** Runs every check and answers the exit code. */
export const cleartextChecks = (): i32 => {
  const t = new Suite("http2 over cleartext");

  // --- 1. Prior knowledge -------------------------------------------------------------------------
  const lb = new H2cLoop(new Http2Config(), 2, 10000);
  // The clock is pinned, so that whole heads compare: Fri, 16 Oct 2026 08:11:54 GMT.
  const noon: i64 = 1792138314000;
  lb.server.date.pin(noon);
  const a = new H2cClient(lb);
  a.prefaces();
  a.wire.headers(toI32(1), plainGet("/hello"), H2_FLAG_END_STREAM);
  a.flush();
  t.eqStr(
    "a client with prior knowledge gets the server's SETTINGS, the acknowledgement of its own and the answer",
    a.awaitFrames(toI32(5)),
    'SETTINGS 1=4096,3=100,4=65535,5=16384,6=16384; WINDOW_UPDATE 0 983041; SETTINGS ack; HEADERS 1 :status=200 date=Fri, 16 Oct 2026 08:11:54 GMT content-type=text/plain; DATA 1 26 "hello from nish/net/http2\n" end'
  );
  t.ok("its preface is whole", lb.server.prefaced(ZERO) && lb.server.busy() === 1);
  a.wire.headers(toI32(3), plainPost("/echo", toI32(10)), ZERO);
  a.wire.data(toI32(3), "0123456789", H2_FLAG_END_STREAM);
  a.flush();
  t.eqStr("a POST's body is echoed back", a.awaitFrames(toI32(2)), 'HEADERS 3 :status=200 date=Fri, 16 Oct 2026 08:11:54 GMT content-type=text/plain; DATA 3 10 "0123456789" end');
  for (let k: i32 = 0; k < 5; k++) {
    a.wire.headers(toI32(5) + k * 2, plainGet("/warm"), H2_FLAG_END_STREAM);
    a.flush();
    a.awaitFrames(toI32(2));
  }
  lb.growth = toI64(0);
  lb.measuring = true;
  let answered: i32 = 0;
  for (let k: i32 = 0; k < 100; k++) {
    const stream: i32 = toI32(15) + k * 2;
    a.wire.headers(stream, plainGet("/hello"), H2_FLAG_END_STREAM);
    a.flush();
    if (a.awaitFrames(toI32(2)).indexOf(`DATA ${stream} 26 "hello from nish/net/http2\n" end`) >= 0) {
      answered = answered + 1;
    }
  }
  lb.measuring = false;
  t.eqI32("a hundred more GETs on the warmed connection are answered", answered, toI32(100));
  t.ok(`and the server's serve calls moved the arena not at all (${lb.growth} bytes)`, lb.growth === toI64(0));
  t.ok(
    `and with every frame sent, the idle slot holds none of its frame buffers (${lb.server.pools.lent()} lent)`,
    lb.server.pools.lent() === 0 && lb.server.pools.made() > 0
  );
  a.wire.goaway(toI32(213), ZERO);
  a.flush();
  t.ok("after the client's GOAWAY the server ends the connection and its program closes the slot", lb.awaitClosed(toI32(1)) && lb.server.busy() === 0);
  t.eqStr("with nothing gone wrong in the loop", lb.failure, "");
  lb.shutdown();

  // --- 2. The preface -----------------------------------------------------------------------------
  const lp = new H2cLoop(new Http2Config(), 2, 100);
  const http1 = new H2cClient(lp);
  http1.sendText("G");
  t.ok("an HTTP/1.1 request line is closed at its first byte, with nothing written", http1.shutOut() && lp.awaitClosed(toI32(1)));
  const upgrade = new H2cClient(lp);
  upgrade.sendText("GET / HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade, HTTP2-Settings\r\nUpgrade: h2c\r\nHTTP2-Settings: AAMAAABkAAQCAAAAAAIAAAAA\r\n\r\n");
  t.ok("an Upgrade: h2c request is closed, with nothing written", upgrade.shutOut() && lp.awaitClosed(toI32(2)));
  const wrong = new H2cClient(lp);
  wrong.sendText(PREFACE.substring(0, 10));
  lp.wait(toI32(50));
  t.ok("ten bytes of the preface hold the slot", lp.server.busy() === 1 && !lp.server.prefaced(lp.accepted - 1) && lp.closed === 2);
  wrong.sendText("X");
  t.ok("and an eleventh that differs closes it, with nothing written", wrong.shutOut() && lp.awaitClosed(toI32(3)) && lp.server.busy() === 0);
  const leaver = new H2cClient(lp);
  leaver.sendText(PREFACE.substring(0, 10));
  lp.wait(toI32(50));
  lp.hangUp(leaver.index);
  t.ok("ten bytes of the preface and a hang-up free the slot", lp.awaitClosed(toI32(4)) && lp.server.busy() === 0);
  const silent = new H2cClient(lp);
  silent.sendText(PREFACE.substring(0, 10));
  lp.wait(toI32(50));
  t.ok("ten bytes of the preface and silence wait no more than prefaceTimeout", lp.awaitExpired(toI32(2000)) === 1 && lp.server.busy() === 0);
  t.ok("and are closed, with nothing written", silent.shutOut());
  const b = new H2cClient(lp);
  const c = new H2cClient(lp);
  b.sendText("PRI");
  c.sendText("PRI");
  const d = new H2cClient(lp);
  t.ok(`two clients mid-preface fill the pool and a third is shed (${lp.refused} shed)`, lp.awaitEnd(d.index) && lp.refused === 1 && lp.server.busy() === 2);
  t.ok(`and none of it has made a frame buffer (${lp.server.pools.made()} made)`, lp.server.pools.made() === 0);
  lp.hangUp(b.index);
  lp.hangUp(c.index);
  t.ok("the two are closed once they hang up", lp.awaitClosed(toI32(7)) && lp.server.busy() === 0);
  t.ok(
    "a free slot answers H2_ERROR to next and done to the rest",
    lp.server.next(ZERO) === H2_ERROR && (lp.server.flush(ZERO) & H2C_DONE) !== 0 && lp.server.fd(ZERO) === -1 && !lp.server.holds(toI32(9))
  );
  lp.server.date.pin(noon);
  const splits: i32[] = [toI32(1), toI32(10), toI32(23)];
  for (let k: i32 = 0; k < 3; k++) {
    const at: i32 = splits[k];
    const split = new H2cClient(lp);
    const slot: i32 = lp.lastSlot;
    split.prefaces();
    split.wire.headers(toI32(1), plainGet("/hello"), H2_FLAG_END_STREAM);
    split.flushSplit(at);
    t.eqStr(
      `a preface split after its byte ${at} is held and answered as one`,
      split.awaitFrames(toI32(5)),
      'SETTINGS 1=4096,3=100,4=65535,5=16384,6=16384; WINDOW_UPDATE 0 983041; SETTINGS ack; HEADERS 1 :status=200 date=Fri, 16 Oct 2026 08:11:54 GMT content-type=text/plain; DATA 1 26 "hello from nish/net/http2\n" end'
    );
    const pending = new H2cClient(lp);
    pending.sendText(PREFACE.substring(0, 10));
    lp.wait(toI32(10));
    const late: i64 = monotonicNanos() + toI64(60000) * toI64(1000000);
    const expired: i32 = lp.server.expire(late);
    lp.closed = lp.closed + expired;
    t.ok(
      `and expire a minute past the deadline closes the slot mid-preface beside it (${expired}) and spares slot ${slot}`,
      expired === 1 && pending.shutOut() && lp.server.holds(slot) && lp.server.prefaced(slot) && lp.server.busy() === 1
    );
    split.wire.headers(toI32(3), plainGet("/hello"), H2_FLAG_END_STREAM);
    split.flush();
    t.eqStr("which still answers", split.awaitFrames(toI32(2)), 'HEADERS 3 :status=200 date=Fri, 16 Oct 2026 08:11:54 GMT content-type=text/plain; DATA 3 26 "hello from nish/net/http2\n" end');
    split.wire.goaway(toI32(3), ZERO);
    split.flush();
    t.ok("and closes on its GOAWAY", lp.awaitClosed(lp.closed + 1) && lp.server.busy() === 0);
  }
  t.eqStr("with nothing gone wrong in the loop", lp.failure, "");
  lp.shutdown();

  // --- 3. Slots without connections ---------------------------------------------------------------
  const listener: i32 = tcpListen("127.0.0.1", 0, 16);
  const big = new Http2CleartextServer(new Http2Config(), listener, toI32(1024), toI32(10000));
  t.ok(
    `a server of ${big.size()} slots and no connection has made no frame buffer (${big.pools.made()}) and one connection, slot 0's (${big.connections.length})`,
    big.size() === toI32(1024) && big.pools.made() === 0 && big.connections.length === 1
  );
  t.ok(
    "a slot never accepted into is free and names slot 0's connection",
    !big.holds(toI32(700)) && big.next(toI32(700)) === H2_ERROR && big.connection(toI32(700)) === big.connection(ZERO) && big.expire(monotonicNanos()) === 0
  );
  netClose(listener);
  return t.done();
};

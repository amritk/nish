// `nish/net/http2-tls` over loopback: Nish clients that speak TLS 1.3 and
// HTTP/2 against the carrier, in one readiness loop.
//
//   1. ALPN h2: the handshake, the server's SETTINGS once it is done, a GET
//      answered with its body, a POST whose body is echoed back, and a
//      hundred more DATA frames through one stream with the server's calls
//      moving the arena not at all; then, the server's clock pinned, a date
//      on every response that costs the arena nothing as the clock moves on.
//   2. The client's GOAWAY: the server finishes, sends close_notify, and its
//      program closes the slot.
//   3. ALPN that did not choose h2: the slot is shut down with close_notify
//      and no HTTP/2 byte is sent.
//   4. The pool: a client past it is shed, and a client that hangs up is
//      closed; a free slot answers H2_ERROR and done. Two slots send one
//      date, formatted once between them. Every buffer a slot borrowed is
//      back in its pool once the clients are gone, the one a client left
//      mid-frame included.
//   5. A server of 1,024 slots and no connection has made no frame buffer.
//
// A third-party client drives the same server in `serve` mode (`main.ts`).
import { TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { TLS_CONTENT_ALERT, TLS_CONTENT_APPLICATION_DATA, TLS_CONTENT_HANDSHAKE, TlsRecordProtection } from "nish/net/tls/record";
import { TLS_RECORD_DONE } from "nish/net/tls/record-server";
import { TLS_GROUP_X25519, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec";
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame";
import { H2_ERROR, Http2Config, Http2Connection, Http2Pools } from "nish/net/http2";
import { netClose, tcpListen } from "nish:net";
import { H2_ALPN, Http2TlsServer } from "nish/net/http2-tls";
import { Suite } from "nish/testing";
import { leafPublic, tcpConfig } from "../net_tls_common/server";
import { GROUP_SECP256R1, clientFinish, clientHello, clientShare, extAlpn, extKeyShare, extSignatureAlgorithms, extSupportedGroups, extSupportedVersions } from "../net_tls_common/client";
import { Opened, ZERO, join, openOne, protectionFor, range, sealOne } from "../net_tls_record_common/bytes";
import { clearRecord, clientKeysFor } from "../net_tls_record_common/client";
import { FrameLog, Wire, getOf, postOf } from "../net_http2/peer";
import { H2Loop } from "./harness";

/** The suite every client here offers. */
const SUITE: i32 = TLS_CHACHA20_POLY1305_SHA256;

/** One client: its socket in the loop, its record keys, and the HTTP/2 frames it has read. */
class H2Client {
  lb: H2Loop;
  index: i32 = -1;
  read: TlsRecordProtection;
  write: TlsRecordProtection;
  wire: Wire;
  log: FrameLog;
  /** The alerts the server sent, as `level description`. */
  alerts: string[];
  /** Whether the server's CertificateVerify and Finished both verified. */
  verified: boolean = false;

  constructor(lb: H2Loop) {
    this.lb = lb;
    this.read = new TlsRecordProtection();
    this.write = new TlsRecordProtection();
    this.wire = new Wire();
    this.log = new FrameLog();
    this.alerts = [];
  }

  /** Connects and completes a TLS 1.3 handshake offering `alpn`; false when anything went wrong. */
  handshake(alpn: string[]): boolean {
    this.index = this.lb.connect();
    if (this.index < 0) {
      return false;
    }
    const extensions: u8[][] = [
      extSupportedVersions([TLS_VERSION_13]),
      extSupportedGroups([TLS_GROUP_X25519, GROUP_SECP256R1]),
      extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
      extKeyShare([TLS_GROUP_X25519], [clientShare()]),
    ];
    if (toI32(alpn.length) > 0) {
      extensions.push(extAlpn(alpn));
    }
    const hello: u8[] = clientHello([SUITE], extensions);
    this.lb.send(this.index, clearRecord(hello));
    const serverHello: u8[] = this.lb.nextRecord(this.index);
    if (toI32(serverHello.length) < 5) {
      return false;
    }
    const helloBody: u8[] = range(serverHello, toI32(5), toI32(serverHello.length));
    const keys = clientKeysFor(32, hello, helloBody);
    const flight: Opened = openOne(protectionFor(SUITE, keys.serverHandshake), this.lb.nextRecord(this.index));
    const view = clientFinish(32, hello, helloBody, flight.content, leafPublic());
    this.verified = view.signatureVerifies && view.serverFinishedVerifies;
    keys.finishWith(flight.content);
    this.read.install(SUITE, keys.serverApplication);
    this.write.install(SUITE, keys.clientApplication);
    this.lb.send(this.index, sealOne(protectionFor(SUITE, keys.clientHandshake), TLS_CONTENT_HANDSHAKE, keys.finished, ZERO));
    return true;
  }

  /** Seals what `wire` holds into application-data records and sends them. */
  flush(): void {
    const bytes: u8[] = this.wire.take();
    const records: u8[][] = [];
    for (let at: i32 = 0; at < toI32(bytes.length); at += 16000) {
      const end: i32 = at + 16000 < toI32(bytes.length) ? at + 16000 : toI32(bytes.length);
      records.push(sealOne(this.write, TLS_CONTENT_APPLICATION_DATA, range(bytes, at, end), ZERO));
    }
    this.lb.send(this.index, join(records));
  }

  /** Reads records until the log holds `n` frames, an alert arrives, or the stream ends; answers the frames joined. */
  awaitFrames(n: i32): string {
    while (toI32(this.log.frames.length) < n && toI32(this.alerts.length) === 0) {
      const record: u8[] = this.lb.nextRecord(this.index);
      if (toI32(record.length) === 0) {
        break;
      }
      const opened: Opened = openOne(this.read, record);
      if (opened.type === TLS_CONTENT_ALERT && toI32(opened.content.length) === 2) {
        this.alerts.push(`${opened.content[0]} ${opened.content[1]}`);
      } else if (opened.type === TLS_CONTENT_APPLICATION_DATA) {
        this.log.push(opened.content, ZERO, toI32(opened.content.length));
      }
    }
    return this.log.take();
  }

  /** The preface, an empty SETTINGS and the acknowledgement of the server's. */
  prefaces(): void {
    const ids: i32[] = [];
    const values: i64[] = [];
    this.wire.preface();
    this.wire.settings(ids, values);
    this.wire.settingsAck();
  }
}

/**
 * Runs every check and answers the exit code. A function of its own so that
 * `tests/link/net_http2_tls_f64` runs the same checks under
 * `--number-mode f64`.
 */
export const tlsChecks = (): i32 => {
  const t = new Suite("http2 over tls");

  // --- 1. ALPN h2 ---------------------------------------------------------------------------
  const lb = new H2Loop(tcpConfig([H2_ALPN, "http/1.1"]), new Http2Config(), 2);
  // The clock is pinned, so that whole heads compare: Fri, 16 Oct 2026 08:11:54 GMT.
  const noon: i64 = 1792138314000;
  lb.server.date.pin(noon);
  const a = new H2Client(lb);
  t.ok("a client offering h2 completes the handshake, the server's signature and Finished verified", a.handshake([H2_ALPN]) && a.verified);
  a.prefaces();
  a.wire.headers(toI32(1), getOf("/hello"), H2_FLAG_END_STREAM);
  a.flush();
  t.eqStr("ALPN chose h2", lb.server.alpn(ZERO), "h2");
  t.eqStr(
    "the server's SETTINGS come once the handshake is done, then the acknowledgement and the answer",
    a.awaitFrames(toI32(5)),
    'SETTINGS 1=4096,3=100,4=65535,5=16384,6=16384; WINDOW_UPDATE 0 983041; SETTINGS ack; HEADERS 1 :status=200 date=Fri, 16 Oct 2026 08:11:54 GMT content-type=text/plain; DATA 1 26 "hello from nish/net/http2\n" end'
  );
  a.wire.headers(toI32(3), postOf("/echo", toI32(10)), ZERO);
  a.wire.data(toI32(3), "0123456789", H2_FLAG_END_STREAM);
  a.flush();
  t.eqStr("a POST's body is echoed back", a.awaitFrames(toI32(2)), 'HEADERS 3 :status=200 date=Fri, 16 Oct 2026 08:11:54 GMT content-type=text/plain; DATA 3 10 "0123456789" end');

  const open: string[] = [":method", "POST", ":scheme", "https", ":path", "/stream", ":authority", "example.com"];
  a.wire.headers(toI32(5), open, ZERO);
  a.flush();
  a.awaitFrames(toI32(1));
  lb.measuring = true;
  let echoed: i32 = 0;
  for (let k: i32 = 0; k < 100; k++) {
    a.wire.data(toI32(5), `chunk ${k}`, ZERO);
    a.flush();
    if (a.awaitFrames(toI32(1)) === `DATA 5 ${`chunk ${k}`.length} "chunk ${k}"`) {
      echoed = echoed + 1;
    }
  }
  lb.measuring = false;
  t.eqI32("a hundred DATA frames through one open stream come back", echoed, toI32(100));
  t.ok(`and the server's calls moved the arena not at all (${lb.growth} bytes)`, lb.growth === toI64(0));
  t.ok(
    `and with every frame sent, the idle slot holds none of its frame buffers (${lb.server.pools.lent()} lent)`,
    lb.server.pools.lent() === 0 && lb.server.pools.made() > 0
  );
  // A new stream costs the arena the same with or without a date, so what the
  // date costs is the difference between five streams on a still clock and
  // five more with the clock a second on before each.
  lb.growth = toI64(0);
  lb.measuring = true;
  for (let k: i32 = 1; k <= 5; k++) {
    a.wire.headers(toI32(5) + k * 2, getOf("/hello"), H2_FLAG_END_STREAM);
    a.flush();
    a.awaitFrames(toI32(2));
  }
  lb.measuring = false;
  const still: i64 = lb.growth;
  const formatted: i64 = lb.server.date.formats();
  lb.growth = toI64(0);
  lb.measuring = true;
  let dated: i32 = 0;
  for (let k: i32 = 1; k <= 5; k++) {
    lb.server.date.pin(noon + toI64(k) * toI64(1000));
    a.wire.headers(toI32(15) + k * 2, getOf("/hello"), H2_FLAG_END_STREAM);
    a.flush();
    if (a.awaitFrames(toI32(2)).indexOf(`:status=200 date=Fri, 16 Oct 2026 08:11:${54 + k} GMT content-type`) >= 0) {
      dated = dated + 1;
    }
  }
  lb.measuring = false;
  lb.server.date.pin(noon);
  t.eqI32("five responses, the pinned clock a second on before each, carry its date", dated, toI32(5));
  t.ok(
    `formatting it once a second, and the arena moves no further than on a still clock (${lb.server.date.formats() - formatted} formats, ${lb.growth} and ${still} bytes)`,
    lb.server.date.formats() - formatted === toI64(5) && lb.growth === still
  );

  // --- 2. The client's GOAWAY -------------------------------------------------------------------
  a.wire.data(toI32(5), "", H2_FLAG_END_STREAM);
  a.wire.goaway(toI32(5), ZERO);
  a.flush();
  t.eqStr("the last stream ends", a.awaitFrames(toI32(1)), 'DATA 5 0 "" end');
  a.awaitFrames(toI32(1));
  t.ok("after the client's GOAWAY the server sends close_notify", a.alerts.join(",") === "1 0");
  t.ok("and its program closes the slot", lb.awaitClosed(toI32(1)) && lb.awaitEnd(a.index) && lb.server.busy() === 0);

  // --- 3. ALPN that did not choose h2 ---------------------------------------------------------
  const b = new H2Client(lb);
  const noAlpn: string[] = [];
  t.ok("a client offering no ALPN completes the handshake", b.handshake(noAlpn) && b.verified);
  b.prefaces();
  b.flush();
  t.eqStr("but the slot is shut down with close_notify, before any HTTP/2 byte", `${b.awaitFrames(toI32(1))}|${b.alerts.join(",")}`, "|1 0");
  t.ok("and closed", lb.awaitClosed(toI32(2)) && lb.server.busy() === 0);

  // --- 3b. A client that sends its requests and closes its side at once ------------------------
  const h = new H2Client(lb);
  t.ok("a client that will close at once completes the handshake", h.handshake([H2_ALPN]));
  h.prefaces();
  h.wire.headers(toI32(1), getOf("/one"), H2_FLAG_END_STREAM);
  h.wire.headers(toI32(3), getOf("/two"), H2_FLAG_END_STREAM);
  const requests: u8[] = h.wire.take();
  h.lb.send(h.index, join([sealOne(h.write, TLS_CONTENT_APPLICATION_DATA, requests, ZERO), sealOne(h.write, TLS_CONTENT_ALERT, [toU8(1), toU8(0)], ZERO)]));
  t.eqStr(
    "its requests and its close_notify in one write: both requests are still answered",
    h.awaitFrames(toI32(7)),
    'SETTINGS 1=4096,3=100,4=65535,5=16384,6=16384; WINDOW_UPDATE 0 983041; SETTINGS ack; HEADERS 1 :status=200 date=Fri, 16 Oct 2026 08:11:54 GMT content-type=text/plain; DATA 1 26 "hello from nish/net/http2\n" end; HEADERS 3 :status=200 date=Fri, 16 Oct 2026 08:11:54 GMT content-type=text/plain; DATA 3 26 "hello from nish/net/http2\n" end'
  );
  h.awaitFrames(toI32(1));
  t.ok("and only then does the server close its side", h.alerts.join(",") === "1 0" && lb.awaitClosed(toI32(3)));

  // --- 4. The pool ---------------------------------------------------------------------------------
  const first: Http2Connection = lb.server.connections[0];
  t.ok(
    `one client at a time has used slot 0 alone, and slot 1's connection is not made (${lb.server.connections.length} made)`,
    lb.server.connections.length === 1 && lb.acceptSlot === 0
  );
  const c = new H2Client(lb);
  const d = new H2Client(lb);
  const e = new H2Client(lb);
  const beforeC: i32 = lb.accepted;
  t.ok("a client accepted again into slot 0", c.handshake([H2_ALPN]) && lb.acceptSlot === 0 && lb.accepted === beforeC + 1);
  t.ok(`moves the arena not at all (${lb.acceptGrowth} bytes)`, lb.acceptGrowth === toI64(0) && lb.server.connections[0] === first);
  const beforeD: i32 = lb.accepted;
  t.ok("and a second fills the pool, accepted into slot 1", d.handshake([H2_ALPN]) && lb.acceptSlot === 1 && lb.accepted === beforeD + 1);
  t.ok(
    `whose connection the first accept into it makes (${lb.acceptGrowth > toI64(0) ? "some" : "no"} bytes, ${lb.server.connections.length} made)`,
    lb.acceptGrowth > toI64(0) && lb.server.connections.length === 2
  );
  e.index = lb.connect();
  t.ok("a third is accepted and shed", lb.awaitEnd(e.index) && lb.refused === 1);
  lb.server.date.pin(noon + toI64(60000));
  const shared: i64 = lb.server.date.formats();
  c.prefaces();
  c.wire.headers(toI32(1), getOf("/c"), H2_FLAG_END_STREAM);
  c.flush();
  const fromC: string = c.awaitFrames(toI32(5));
  d.prefaces();
  d.wire.headers(toI32(1), getOf("/d"), H2_FLAG_END_STREAM);
  d.flush();
  const fromD: string = d.awaitFrames(toI32(5));
  const minute: string = "HEADERS 1 :status=200 date=Fri, 16 Oct 2026 08:12:54 GMT content-type";
  t.ok("each slot's response carries the one date", fromC.indexOf(minute) >= 0 && fromD.indexOf(minute) >= 0);
  t.ok(
    `which the two slots share: formatted once between them (${lb.server.date.formats() - shared})`,
    lb.server.date.formats() - shared === toI64(1)
  );
  // Three bytes of a frame header and no more: the slot holds them unread when the client goes.
  c.lb.send(c.index, sealOne(c.write, TLS_CONTENT_APPLICATION_DATA, [toU8(0), toU8(0), toU8(4)], ZERO));
  const pools: Http2Pools = lb.server.pools;
  let waits: i32 = 0;
  while (pools.input.lent() === 0 && waits < 100 && lb.failure === "") {
    lb.step(toI32(-1));
    waits = waits + 1;
  }
  t.ok(`the slot sent three bytes of a frame header holds its input over them (${pools.input.lent()} lent)`, pools.input.lent() === 1);
  lb.hangUp(c.index);
  lb.hangUp(d.index);
  t.ok("two clients that hang up are closed", lb.awaitClosed(toI32(5)) && lb.server.busy() === 0);
  t.ok(
    `once every connection has ended, one of them mid-frame, every pool has all its buffers back (${pools.input.lent()}, ${pools.output.lent()}, ${pools.block.lent()} lent)`,
    pools.input.lent() === 0 && pools.output.lent() === 0 && pools.block.lent() === 0
  );
  t.ok(`and each pool made one buffer, which the two slots took in turn (${pools.input.made}, ${pools.output.made}, ${pools.block.made})`, pools.input.made === 1 && pools.output.made === 1 && pools.block.made === 1);
  t.ok(
    "a free slot answers H2_ERROR to next and done to the rest",
    lb.server.next(ZERO) === H2_ERROR && (lb.server.flush(ZERO) & TLS_RECORD_DONE) !== 0 && lb.server.fd(ZERO) === -1 && !lb.server.holds(toI32(9))
  );
  t.ok("a slot out of range names the first connection", lb.server.connection(toI32(9)) === lb.server.connection(ZERO) && lb.server.size() === 2);
  t.eqStr("with nothing gone wrong in the loop", lb.failure, "");
  lb.shutdown();

  // --- 5. Slots without connections ------------------------------------------------------------
  const listener: i32 = tcpListen("127.0.0.1", 0, 16);
  const big = new Http2TlsServer(tcpConfig([H2_ALPN]), new Http2Config(), listener, toI32(1024));
  t.ok(
    `a server of ${big.size()} slots and no connection has made no frame buffer (${big.pools.made()})`,
    big.size() === toI32(1024) && big.pools.made() === 0
  );
  t.ok(`and has made one slot's connection, slot 0's (${big.connections.length})`, big.connections.length === 1);
  t.ok(
    "a slot never accepted into is free: no descriptor, H2_ERROR to next, done to flush",
    !big.holds(toI32(700)) && big.fd(toI32(700)) === -1 && big.next(toI32(700)) === H2_ERROR && (big.flush(toI32(700)) & TLS_RECORD_DONE) !== 0
  );
  big.rest(toI32(700));
  big.close(toI32(700));
  t.ok(
    "and names slot 0's connection, making none for itself",
    big.connection(toI32(700)) === big.connection(ZERO) && big.connections.length === 1 && big.busy() === 0
  );
  netClose(listener);
  return t.done();
};

// `nish/net/http2-tls` over loopback: Nish clients that speak TLS 1.3 and
// HTTP/2 against the carrier, in one readiness loop.
//
//   1. ALPN h2: the handshake, the server's SETTINGS once it is done, a GET
//      answered with its body, a POST whose body is echoed back, and a
//      hundred more DATA frames through one stream with the server's calls
//      moving the arena not at all.
//   2. The client's GOAWAY: the server finishes, sends close_notify, and its
//      program closes the slot.
//   3. ALPN that did not choose h2: the slot is shut down with close_notify
//      and no HTTP/2 byte is sent.
//   4. The pool: a client past it is shed, and a client that hangs up is
//      closed; a free slot answers H2_ERROR and done.
//
// A third-party client drives the same server in `serve` mode (`main.ts`).
import { TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { TLS_CONTENT_ALERT, TLS_CONTENT_APPLICATION_DATA, TLS_CONTENT_HANDSHAKE, TlsRecordProtection } from "nish/net/tls/record";
import { TLS_RECORD_DONE } from "nish/net/tls/record-server";
import { TLS_GROUP_X25519, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec";
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame";
import { H2_ERROR, Http2Config } from "nish/net/http2";
import { H2_ALPN } from "nish/net/http2-tls";
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
  const a = new H2Client(lb);
  t.ok("a client offering h2 completes the handshake, the server's signature and Finished verified", a.handshake([H2_ALPN]) && a.verified);
  a.prefaces();
  a.wire.headers(toI32(1), getOf("/hello"), H2_FLAG_END_STREAM);
  a.flush();
  t.eqStr("ALPN chose h2", lb.server.alpn(ZERO), "h2");
  t.eqStr(
    "the server's SETTINGS come once the handshake is done, then the acknowledgement and the answer",
    a.awaitFrames(toI32(5)),
    'SETTINGS 1=4096,3=100,4=65535,5=16384,6=16384; WINDOW_UPDATE 0 983041; SETTINGS ack; HEADERS 1 :status=200 content-type=text/plain; DATA 1 26 "hello from nish/net/http2\n" end'
  );
  a.wire.headers(toI32(3), postOf("/echo", toI32(10)), ZERO);
  a.wire.data(toI32(3), "0123456789", H2_FLAG_END_STREAM);
  a.flush();
  t.eqStr("a POST's body is echoed back", a.awaitFrames(toI32(2)), 'HEADERS 3 :status=200 content-type=text/plain; DATA 3 10 "0123456789" end');

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
    'SETTINGS 1=4096,3=100,4=65535,5=16384,6=16384; WINDOW_UPDATE 0 983041; SETTINGS ack; HEADERS 1 :status=200 content-type=text/plain; DATA 1 26 "hello from nish/net/http2\n" end; HEADERS 3 :status=200 content-type=text/plain; DATA 3 26 "hello from nish/net/http2\n" end'
  );
  h.awaitFrames(toI32(1));
  t.ok("and only then does the server close its side", h.alerts.join(",") === "1 0" && lb.awaitClosed(toI32(3)));

  // --- 4. The pool ---------------------------------------------------------------------------------
  const c = new H2Client(lb);
  const d = new H2Client(lb);
  const e = new H2Client(lb);
  t.ok("two clients fill the pool", c.handshake([H2_ALPN]) && d.handshake([H2_ALPN]));
  e.index = lb.connect();
  t.ok("a third is accepted and shed", lb.awaitEnd(e.index) && lb.refused === 1);
  lb.hangUp(c.index);
  lb.hangUp(d.index);
  t.ok("two clients that hang up are closed", lb.awaitClosed(toI32(5)) && lb.server.busy() === 0);
  t.ok(
    "a free slot answers H2_ERROR to next and done to the rest",
    lb.server.next(ZERO) === H2_ERROR && (lb.server.flush(ZERO) & TLS_RECORD_DONE) !== 0 && lb.server.fd(ZERO) === -1 && !lb.server.holds(toI32(9))
  );
  t.ok("a slot out of range names the first connection", lb.server.connection(toI32(9)) === lb.server.connection(ZERO) && lb.server.size() === 2);
  t.eqStr("with nothing gone wrong in the loop", lb.failure, "");
  lb.shutdown();
  return t.done();
};

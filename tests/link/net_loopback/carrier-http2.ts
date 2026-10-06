// HTTP/2 over TLS: `nish/net/http2-tls` with ALPN `h2`, answered by
// `H2App`, and a Nish client that writes its frames with the HTTP/2 lane's
// `Wire`, renders what the server sends with its `FrameLog`, and keeps the
// flow-control books itself from the frames the kernel hands it: it sends
// DATA only within the windows the server's SETTINGS and WINDOW_UPDATEs gave
// it, and gives back what it reads with WINDOW_UPDATEs of its own. Its
// SETTINGS offer the server a 16,384-byte stream window, so every echo
// larger than that waits on the client's refills, as every body larger than
// the server's 65,535 bytes waits on the server's.
import { Suite } from "nish/testing";
import { H2_FLAG_END_STREAM, H2_FRAME_DATA, H2_FRAME_SETTINGS, H2_FRAME_WINDOW_UPDATE, H2_FLAG_ACK, Http2Frame, http2ParseFrame, http2ReadHeader, http2SettingCount, http2SettingId, http2SettingValue } from "nish/net/http2-frame";
import { H2_ALPN } from "nish/net/http2-tls";
import { ZERO, ascii, range } from "../net_tls_record_common/bytes";
import { h3IsPattern, h3Pattern } from "../net_http3/peer";
import { FrameLog, Wire, getOf, postOf } from "../net_http2/peer";
import { textOf } from "../crypto_x509/hex";
import { CARRIER_H2, TcpLoop } from "./tcp";
import { TlsClient } from "./tls-client";
import { LbMeter, ROUNDS, WARM, roundText } from "./common";

/** The stream window the client's SETTINGS give the server. */
const CLIENT_WINDOW: i32 = 16384;

/** The client: its TLS stream, what it writes, what it has read, and both sides' windows. */
class H2Client {
  c: TlsClient;
  wire: Wire;
  log: FrameLog;
  frame: Http2Frame;
  /** Per stream the client opened: its id, the body the server sent on it, whether that ended, and the client's send window. */
  ids: i32[];
  bodies: u8[][];
  ended: boolean[];
  windows: i64[];
  /** The connection's send window, and the window each new stream starts with, from the server's SETTINGS. */
  connWindow: i64 = 65535;
  initialWindow: i64 = 65535;
  /** WINDOW_UPDATEs each side sent for a stream, not the connection: refills that had to happen. */
  serverRefills: i32 = 0;
  clientRefills: i32 = 0;

  constructor(c: TlsClient) {
    this.c = c;
    this.wire = new Wire();
    this.log = new FrameLog();
    this.frame = new Http2Frame();
    this.ids = [];
    this.bodies = [];
    this.ended = [];
    this.windows = [];
  }

  /** The record of stream `id`, made the first time. */
  at(id: i32): i32 {
    for (let k: i32 = 0; k < toI32(this.ids.length); k++) {
      if (this.ids[k] === id) {
        return k;
      }
    }
    this.ids.push(id);
    const none: u8[] = [];
    this.bodies.push(none);
    this.ended.push(false);
    this.windows.push(this.initialWindow);
    return toI32(this.ids.length) - 1;
  }

  /** Seals what `wire` holds and sends it. */
  flush(): void {
    const bytes: u8[] = this.wire.take();
    if (toI32(bytes.length) > 0) {
      this.c.send(bytes);
    }
  }

  /** Reads every whole frame opened so far: the log renders it, DATA is kept and given back, WINDOW_UPDATE and SETTINGS move the windows. */
  read(): void {
    const p: u8[] = this.c.plain;
    const n: i32 = toI32(p.length);
    const f: Http2Frame = this.frame;
    let at: i32 = 0;
    while (http2ReadHeader(f, p, at, n - at) && n - at >= 9 + f.length) {
      http2ParseFrame(f, p, at, toI32(16777215));
      this.log.push(p, at, 9 + f.length);
      if (f.type === H2_FRAME_DATA) {
        const k: i32 = this.at(f.streamId);
        for (let j: i32 = 0; j < f.contentLength; j++) {
          this.bodies[k].push(p[f.contentStart + j]);
        }
        this.ended[k] = this.ended[k] || f.has(H2_FLAG_END_STREAM);
        if (f.length > 0) {
          this.wire.windowUpdate(ZERO, f.length);
          if (!this.ended[k]) {
            this.wire.windowUpdate(f.streamId, f.length);
            this.clientRefills = this.clientRefills + 1;
          }
        }
      } else if (f.type === H2_FRAME_WINDOW_UPDATE) {
        if (f.streamId === 0) {
          this.connWindow = this.connWindow + toI64(f.increment);
        } else {
          const k: i32 = this.at(f.streamId);
          this.windows[k] = this.windows[k] + toI64(f.increment);
          this.serverRefills = this.serverRefills + 1;
        }
      } else if (f.type === H2_FRAME_SETTINGS && !f.has(H2_FLAG_ACK)) {
        for (let j: i32 = 0; j < http2SettingCount(f); j++) {
          if (http2SettingId(f, p, j) === 4) {
            this.initialWindow = http2SettingValue(f, p, j);
          }
        }
      }
      at = at + 9 + f.length;
    }
    this.c.take(at);
  }

  /** Opens one more record and reads its frames; false on a timeout, an alert or the end of the stream. */
  pump(): boolean {
    if (!this.c.pump() || toI32(this.c.alerts.length) > 0) {
      return false;
    }
    this.read();
    return true;
  }

  /**
   * Sends `bodies[k]` on `streams[k]`, every stream at once and each with
   * END_STREAM after its last byte: as much DATA as both windows allow, then
   * a record read, until every stream's echo has ended. Answers false on a
   * timeout.
   */
  exchange(streams: i32[], bodies: u8[][]): boolean {
    const sent: i32[] = [];
    for (let k: i32 = 0; k < toI32(streams.length); k++) {
      sent.push(0);
      this.at(streams[k]);
    }
    for (let rounds: i32 = 0; rounds < 100000; rounds++) {
      for (let k: i32 = 0; k < toI32(streams.length); k++) {
        const s: i32 = this.at(streams[k]);
        const total: i32 = toI32(bodies[k].length);
        while (sent[k] < total && this.connWindow > 0 && this.windows[s] > 0) {
          let n: i64 = toI64(total - sent[k]);
          n = Math.min(n, Math.min(toI64(16384), Math.min(this.connWindow, this.windows[s])));
          const last: boolean = sent[k] + toI32(n) === total;
          this.wire.raw(this.dataFrame(streams[k], bodies[k], sent[k], toI32(n), last));
          sent[k] = sent[k] + toI32(n);
          this.connWindow = this.connWindow - n;
          this.windows[s] = this.windows[s] - n;
        }
      }
      this.flush();
      let all: boolean = true;
      for (const id of streams) {
        all = all && this.ended[this.at(id)];
      }
      if (all) {
        return true;
      }
      if (!this.pump()) {
        return false;
      }
    }
    return false;
  }

  /** A DATA frame of `body[at .. at + n)` on `id`, with END_STREAM when `last`. */
  dataFrame(id: i32, body: u8[], at: i32, n: i32, last: boolean): u8[] {
    const out: u8[] = [toU8((n >> 16) & 255), toU8((n >> 8) & 255), toU8(n & 255), toU8(H2_FRAME_DATA), toU8(last ? H2_FLAG_END_STREAM : ZERO)];
    out.push(toU8((id >> 24) & 127));
    out.push(toU8((id >> 16) & 255));
    out.push(toU8((id >> 8) & 255));
    out.push(toU8(id & 255));
    for (let k: i32 = 0; k < n; k++) {
      out.push(body[at + k]);
    }
    return out;
  }

  /** Reads until stream `id`'s echo holds `n` bytes or has ended; answers them, taken out. */
  awaitBody(id: i32, n: i32): u8[] {
    const k: i32 = this.at(id);
    while (toI32(this.bodies[k].length) < n && !this.ended[k]) {
      if (!this.pump()) {
        break;
      }
    }
    const got: u8[] = this.bodies[k];
    this.bodies[k] = range(got, n, toI32(got.length));
    return range(got, ZERO, n);
  }
}

/** Every check of the HTTP/2 carrier. */
export const http2Checks = (t: Suite): void => {
  const lp = new TcpLoop(CARRIER_H2);
  const c = new TlsClient(lp);
  t.ok("http/2: a TLS handshake offering h2 across loopback", c.handshake([H2_ALPN, "http/1.1"]));
  t.eqStr("http/2: ALPN chose h2", lp.h2.alpn(ZERO), "h2");
  const h = new H2Client(c);
  h.wire.preface();
  h.wire.settings([toI32(4)], [toI64(CLIENT_WINDOW)]);
  h.wire.settingsAck();
  h.wire.headers(toI32(1), getOf("/hello"), H2_FLAG_END_STREAM);
  h.flush();
  const hello: string = textOf(h.awaitBody(toI32(1), toI32(20)));
  t.eqStr(
    "http/2: the server's SETTINGS, then a GET answered on stream 1",
    `${h.log.take()} | ${hello}`,
    "SETTINGS 1=4096,3=100,4=65535,5=16384,6=16384; WINDOW_UPDATE 0 983041; SETTINGS ack; HEADERS 1 :status=200 content-type=text/plain; DATA 1 20 \"hello over loopback\n\" end | hello over loopback\n"
  );

  const body: u8[] = h3Pattern(toI32(150000));
  h.wire.headers(toI32(3), postOf("/echo", toI32(150000)), ZERO);
  h.wire.headers(toI32(5), postOf("/echo", toI32(150000)), ZERO);
  const both: boolean = h.exchange([toI32(3), toI32(5)], [body, body]);
  const three: u8[] = h.awaitBody(toI32(3), toI32(150000));
  const five: u8[] = h.awaitBody(toI32(5), toI32(150000));
  t.ok("http/2: two POSTs of 150,000 bytes on streams 3 and 5 at once, each echoed whole on its own stream", both && h3IsPattern(three) && h3IsPattern(five) && toI32(three.length) === 150000 && toI32(five.length) === 150000);
  t.ok(
    "http/2: past the server's 65,535-byte stream window the client waited for its WINDOW_UPDATEs, and past its own 16,384 the server waited for the client's",
    h.serverRefills >= 4 && h.clientRefills >= 18 && lp.h2App.table.overflows === 0
  );
  h.log.take();

  const open: string[] = [":method", "POST", ":scheme", "https", ":path", "/stream", ":authority", "loopback"];
  h.wire.headers(toI32(7), open, ZERO);
  h.flush();
  for (let k: i32 = 0; k < WARM; k++) {
    const warm: u8[] = ascii(`warm ${k}`);
    h.wire.raw(h.dataFrame(toI32(7), warm, ZERO, toI32(warm.length), false));
    h.flush();
    h.awaitBody(toI32(7), toI32(warm.length));
  }
  const rounds = new LbMeter(false);
  lp.meter = rounds;
  let intact: i32 = 0;
  for (let k: i32 = 0; k < ROUNDS; k++) {
    const message: u8[] = ascii(roundText(k));
    h.wire.raw(h.dataFrame(toI32(7), message, ZERO, toI32(message.length), false));
    h.flush();
    if (textOf(h.awaitBody(toI32(7), toI32(message.length))) === roundText(k)) {
      intact = intact + 1;
    }
  }
  lp.meter = null;
  t.eqI32("http/2: fifty DATA frames echoed on the warm open stream", intact, ROUNDS);
  t.ok(`http/2: and every server wake kept ${rounds.kept} bytes over them`, rounds.kept === toI64(0));

  const request = new LbMeter(true);
  lp.meter = request;
  h.wire.headers(toI32(9), getOf("/hello"), H2_FLAG_END_STREAM);
  h.flush();
  const again: string = textOf(h.awaitBody(toI32(9), toI32(20)));
  lp.meter = null;
  t.eqStr("http/2: a GET on a new stream of the warm connection", again, "hello over loopback\n");
  console.log(`http/2: that request kept ${request.kept} bytes (H2-1, HPACK's per header block)`);

  h.wire.raw(h.dataFrame(toI32(7), ascii("end"), ZERO, toI32(3), true));
  h.flush();
  h.awaitBody(toI32(7), toI32(3));
  h.wire.goaway(toI32(9), ZERO);
  h.flush();
  c.closeNotify();
  t.eqStr("http/2: the client's GOAWAY and close_notify are answered with the server's close_notify", c.awaitAlert(), "1 0");
  t.ok("http/2: the server's program saw the GOAWAY, and the slot closed", lp.h2App.goaways === 1 && lp.awaitEnd(c.index) && lp.awaitClosed(toI32(1)) && lp.busy() === 0);
  t.ok("http/2: every stream ended, none reset", h.ended[h.at(toI32(7))] && lp.h2App.resets === 0 && lp.h2App.requests === 5);
  t.eqStr("http/2: with nothing gone wrong in the loop", lp.failure, "");
  lp.shutdown();
};

// Record mode: the Nish WebTransport server, on a real socket and clock, for a
// `wtransport` 0.7 client to talk to once, with a tap that copies what the
// client sends before the server reads it: each stream's bytes straight out
// of QUIC's receive buffer, each datagram out of QUIC's ring, each
// RESET_STREAM's code and the CONNECTION_CLOSE's. It prints one line per
// stream, datagram, reset and close, which `golden.ts` holds as the
// recording. The application accepts the session, echoes datagrams and
// streams (a unidirectional one on a stream of its own), and closes the
// session with code 7 and "bye" when a datagram says `close`.
import { netLocalPort, pollAdd, pollCreate, pollWait, udpBind } from "nish:net";
import { Secret, secret, wipe } from "nish:secret";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { QuicConnection } from "nish/net/quic";
import { H3_ERROR, H3_NEED_MORE } from "nish/net/http3";
import { Http3Server } from "nish/net/http3-server";
import { WT_DATAGRAM, WT_SESSION, WT_STREAM, WT_STREAM_DATA, WT_STREAM_END, WebTransport } from "nish/net/webtransport";
import { bytesOf, textOf, toHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPrivate } from "../net_tls_common/server";
import { WtLimits, wtConfig, wtH3Config, wtQuicConfig } from "./peer";

/** What the tap has copied of one stream. */
class WtTapped {
  id: i64 = 0;
  bytes: u8[];
  reset: i64 = -1;
  fin: boolean = false;

  constructor(id: i64) {
    this.id = id;
    this.bytes = [];
  }
}

/** The recording, and the echo application's state. */
class WtRecorder {
  streams: WtTapped[];
  datagrams: string[];
  echoes: u8[][];
  echoIds: i64[];
  closeCode: i64 = -1;

  constructor() {
    this.streams = [];
    this.datagrams = [];
    this.echoes = [];
    this.echoIds = [];
  }

  /** The record of stream `id`. */
  tapped(id: i64): WtTapped {
    for (const s of this.streams) {
      if (s.id === id) {
        return s;
      }
    }
    const fresh = new WtTapped(id);
    this.streams.push(fresh);
    return fresh;
  }

  /** Copies what arrived since the last tap: stream bytes not yet read, datagrams not yet taken. */
  tap(quic: QuicConnection): void {
    for (const stream of quic.streams.slots) {
      if (stream.id < 0 || (stream.id & n64(1)) === n64(1)) {
        continue;
      }
      const r: WtTapped = this.tapped(stream.id);
      let at: i64 = toI64(toI32(r.bytes.length));
      while (at < stream.recvContiguous) {
        r.bytes.push(stream.recvBuf[stream.at(at)]);
        at = at + n64(1);
      }
      r.fin = stream.recvFinal >= 0 && at === stream.recvFinal;
      if (stream.resetCode >= 0) {
        r.reset = stream.resetCode;
      }
    }
    const ring = quic.datagramsIn;
    for (let j: i32 = 0; j < ring.count; j++) {
      const k: i32 = (ring.head + j) % ring.capacity();
      const d: u8[] = [];
      for (let b: i32 = 0; b < ring.lengths[k]; b++) {
        d.push(ring.data[k * ring.entrySize + b]);
      }
      this.datagrams.push(toHex(d));
    }
    if (quic.closed() && this.closeCode < 0) {
      this.closeCode = quic.error;
    }
  }

  /** The echo application over `wt`. */
  serve(wt: WebTransport): void {
    let event: i32 = wt.next();
    while (event !== H3_NEED_MORE && event !== H3_ERROR) {
      if (event === WT_SESSION) {
        wt.accept(wt.sessionId);
      } else if (event === WT_DATAGRAM) {
        const d: u8[] = [];
        for (let k: i32 = 0; k < wt.dataLength; k++) {
          d.push(wt.data[wt.dataStart + k]);
        }
        if (textOf(d) === "close") {
          const reason: u8[] = bytesOf("bye");
          wt.close(wt.sessionId, n64(7), reason, n32(0), toI32(reason.length));
        } else {
          wt.sendDatagram(wt.sessionId, d, n32(0), toI32(d.length));
        }
      } else if (event === WT_STREAM) {
        this.echoIds.push(wt.stream);
        const fresh: u8[] = [];
        this.echoes.push(fresh);
      } else if (event === WT_STREAM_DATA) {
        const k: i32 = toI32(this.echoIds.indexOf(wt.stream));
        if (k >= 0) {
          for (let j: i32 = 0; j < wt.dataLength; j++) {
            this.echoes[k].push(wt.data[wt.dataStart + j]);
          }
        }
      } else if (event === WT_STREAM_END) {
        const k: i32 = toI32(this.echoIds.indexOf(wt.stream));
        if (k >= 0) {
          const out: i64 = (wt.stream & n64(2)) === n64(0) ? wt.stream : wt.openStream(wt.sessionId, false);
          wt.write(out, this.echoes[k], n32(0), toI32(this.echoes[k].length), true);
        }
      }
      event = wt.next();
    }
  }
}

/** Milliseconds on the monotonic clock. */
const nowMs = (): i64 => monotonicNanos() / n64(1000000);

/** Serves one connection on UDP `port` (0 for any), printing `port <p>` first and the recording once it closes. */
export const record = (port: i32): i32 => {
  const fd: i32 = udpBind("127.0.0.1", port, n32(0));
  if (fd < 0) {
    console.log(`bind failed: ${fd}`);
    return 1;
  }
  const limits = new WtLimits();
  limits.sessions = n32(1);
  const entropy: u8[] = new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE);
  crypto.getRandomValues(entropy);
  const server = new Http3Server(wtQuicConfig(limits), wtH3Config(limits), fd, n32(1), entropy);
  const wt = new WebTransport(wtConfig(limits), server.connection(n32(0)));
  const recorder = new WtRecorder();
  const loop: i32 = pollCreate();
  pollAdd(loop, fd, n32(1), n32(0));
  const ready: i32[] = new Array<i32>(8);
  console.log(`port ${netLocalPort(fd)}`);
  const start: i64 = nowMs();
  while (server.accepted === 0 || server.busy() > 0) {
    if (nowMs() - start > n64(20000)) {
      console.log("timed out");
      break;
    }
    const wait: i32 = server.timeout(nowMs());
    pollWait(loop, ready, wait < 0 || wait > 100 ? n32(100) : wait);
    const now: i64 = nowMs();
    const key: Secret<u8[]> = secret(leafPrivate());
    server.receive(now, key);
    wipe(key);
    server.tick(now);
    let slot: i32 = server.ready();
    while (slot >= 0) {
      recorder.tap(server.quic(slot));
      recorder.serve(wt);
      slot = server.ready();
    }
    recorder.tap(server.quic(n32(0)));
    server.flush(now);
  }
  for (const s of recorder.streams) {
    console.log(`stream ${s.id} ${toHex(s.bytes)}${s.fin ? " fin" : ""}${s.reset >= 0 ? ` reset ${s.reset}` : ""}`);
  }
  for (const d of recorder.datagrams) {
    console.log(`datagram ${d}`);
  }
  console.log(`close ${recorder.closeCode}`);
  return 0;
};

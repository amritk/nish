// What the WebTransport checks start from: a server — a `QuicConnection`
// that takes DATAGRAM frames, an `Http3Connection` with WebTransport on, and
// a `WebTransport` over it, with a small echo application — and the client
// half that talks to it, sans-IO. The client is `net_quic_conn`'s QUIC
// client with HTTP/3 and WebTransport written on top by hand, the way
// `net_http3/peer.ts` writes HTTP/3: frames from `nish/net/http3-frame`'s
// writers, field sections from `nish/net/qpack`'s encoder, the stream
// signals, session IDs and capsules byte by byte from draft-02's layouts,
// and what the server sends read back from every packet the client opens.
import { Suite } from "nish/testing";
import {
  QUIC_FRAME_CONNECTION_CLOSE,
  QUIC_FRAME_CONNECTION_CLOSE_APP,
  QUIC_FRAME_DATAGRAM,
  QUIC_FRAME_RESET_STREAM,
  QUIC_FRAME_STOP_SENDING,
  QUIC_FRAME_STREAM,
  QuicFrame,
  quicDatagramSize,
  quicParseFrame,
  quicPushAck,
  quicPushStream,
  quicPushStreamError,
  quicPutDatagram,
} from "nish/net/quic-frame";
import { QuicTransportParameters, quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QuicConnection, QuicServerConfig } from "nish/net/quic";
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { QPACK_OK, QpackDecoder, QpackEncoder } from "nish/net/qpack";
import {
  H3_FRAME_DATA,
  H3_FRAME_HEADERS,
  H3_FRAME_WEBTRANSPORT_STREAM,
  H3_SETTINGS_ENABLE_CONNECT_PROTOCOL,
  H3_SETTINGS_ENABLE_WEBTRANSPORT,
  H3_SETTINGS_H3_DATAGRAM,
  H3_SETTINGS_QPACK_BLOCKED_STREAMS,
  H3_SETTINGS_QPACK_MAX_TABLE_CAPACITY,
  H3_SETTINGS_WEBTRANSPORT_MAX_SESSIONS,
  H3_STREAM_CONTROL,
  H3_STREAM_QPACK_DECODER,
  H3_STREAM_QPACK_ENCODER,
  H3_STREAM_WEBTRANSPORT,
  Http3FrameHeader,
  h3PutSettings,
  h3ReadFrameHeader,
} from "nish/net/http3-frame";
import { H3_ALPN, H3_DATA, H3_END, H3_ERROR, H3_NEED_MORE, H3_REQUEST, Http3Config, Http3Connection } from "nish/net/http3";
import {
  WT_CLOSED,
  WT_DATAGRAM,
  WT_DRAIN,
  WT_SESSION,
  WT_STREAM,
  WT_STREAM_DATA,
  WT_STREAM_END,
  WT_STREAM_RESET,
  WT_STREAM_STOPPED,
  WT_WRITABLE,
  WebTransport,
  WebTransportConfig,
} from "nish/net/webtransport";
import { leafCertificate } from "../net_tls_common/server";
import { fromHex, textOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { fixedEntropy, resetKey, tokenKey } from "../net_quic_conn_replay/server";
import { CLIENT_SCID, QcClient, qcConnect, qcDrain, qcExchange, qcHello, qcShort } from "../net_quic_conn/client";
import { h3Cat, h3Frame, h3Hex, h3Section, h3Varint } from "../net_http3/peer";

/** The client's three unidirectional streams: control, QPACK encoder, QPACK decoder. */
export const WT_CLIENT_CONTROL: i64 = 2;
export const WT_CLIENT_ENCODER: i64 = 6;
export const WT_CLIENT_DECODER: i64 = 10;

/** The most stream bytes the client puts in one packet. */
const CHUNK: i32 = 1000;

/** What a case configures: the QUIC limits, the datagram sizes and the WebTransport caps. */
export class WtLimits {
  maxData: i64 = 1048576;
  maxStreamData: i64 = 32768;
  maxStreamsBidi: i64 = 16;
  maxStreamsUni: i64 = 16;
  localStreams: i64 = 16;
  /** The server's `max_datagram_frame_size`, and the client's. */
  datagramFrame: i64 = 1200;
  clientDatagramFrame: i64 = 65535;
  /** What the client lets the server open. */
  clientUniStreams: i64 = 16;
  clientBidiStreams: i64 = 8;
  sessions: i32 = 2;
  maxStreams: i32 = 64;
  maxPending: i32 = 4;
}

/** The QUIC configuration of `limits`: `h3`, and DATAGRAM frames up to `datagramFrame`. */
export const wtQuicConfig = (limits: WtLimits): QuicServerConfig => {
  const chain: u8[][] = [leafCertificate()];
  return {
    certificateChain: chain,
    alpn: [H3_ALPN],
    signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
    maxData: limits.maxData,
    maxStreamData: limits.maxStreamData,
    maxStreamsBidi: limits.maxStreamsBidi,
    maxStreamsUni: limits.maxStreamsUni,
    localStreams: limits.localStreams,
    maxDatagramFrameSize: limits.datagramFrame,
    maxIdleTimeout: n64(30000),
    activeConnectionIdLimit: n64(4),
    statelessResetKey: resetKey(),
    retryTokenKey: tokenKey(),
    retry: false,
    retryTokenLifetime: n64(10000),
  };
};

/** The HTTP/3 configuration: a field-section cap of 8,192, which half a 32 KiB stream buffer holds, and `sessions`. */
export const wtH3Config = (limits: WtLimits): Http3Config => {
  const config = new Http3Config();
  config.maxFieldSectionSize = n32(8192);
  config.webtransportSessions = limits.sessions;
  return config;
};

/** The WebTransport caps of `limits`. */
export const wtConfig = (limits: WtLimits): WebTransportConfig => {
  const config = new WebTransportConfig();
  config.maxStreams = limits.maxStreams;
  config.maxPending = limits.maxPending;
  return config;
};

/** The client's transport parameters: generous credit, DATAGRAM frames, and room for the server's streams. */
export const wtClientParams = (limits: WtLimits): u8[] => {
  const p = new QuicTransportParameters();
  p.initialScid = fromHex(CLIENT_SCID);
  p.hasInitialScid = true;
  p.initialMaxData = n64(67108864);
  p.initialMaxStreamDataBidiLocal = n64(16777216);
  p.initialMaxStreamDataBidiRemote = n64(65536);
  p.initialMaxStreamDataUni = n64(65536);
  p.initialMaxStreamsBidi = limits.clientBidiStreams;
  p.initialMaxStreamsUni = limits.clientUniStreams;
  p.activeConnectionIdLimit = n64(4);
  p.maxDatagramFrameSize = limits.clientDatagramFrame;
  return quicEncodeTransportParameters(p);
};

/** A SETTINGS frame of `ids` and `values`, as bytes. */
export const wtSettingsFrame = (ids: i64[], values: i64[]): u8[] => {
  const buf: u8[] = new Array<u8>(128);
  const n: i32 = h3PutSettings(buf, n32(0), n32(128), ids, values);
  const out: u8[] = [];
  for (let k: i32 = 0; k < n; k++) {
    out.push(buf[k]);
  }
  return out;
};

/** The settings `wtransport` 0.7's client sends: QPACK at 0, extended CONNECT, draft-02 WebTransport, HTTP datagrams, one session. */
export const wtClientSettingIds = (): i64[] => [
  H3_SETTINGS_QPACK_MAX_TABLE_CAPACITY,
  H3_SETTINGS_QPACK_BLOCKED_STREAMS,
  H3_SETTINGS_ENABLE_CONNECT_PROTOCOL,
  H3_SETTINGS_ENABLE_WEBTRANSPORT,
  H3_SETTINGS_H3_DATAGRAM,
  H3_SETTINGS_WEBTRANSPORT_MAX_SESSIONS,
];
export const wtClientSettingValues = (): i64[] => [n64(0), n64(0), n64(1), n64(1), n64(1), n64(1)];

/** A capsule of `type` carrying `payload` (RFC 9297 §3.2), as bytes. */
export const wtCapsule = (type: i64, payload: u8[]): u8[] => h3Frame(type, payload);

/** A CLOSE_WEBTRANSPORT_SESSION payload: a 32-bit `code`, then `reason`. */
export const wtClosePayload = (code: i64, reason: u8[]): u8[] => {
  const out: u8[] = [
    toU8(toI32((code >> n64(24)) & n64(255))),
    toU8(toI32((code >> n64(16)) & n64(255))),
    toU8(toI32((code >> n64(8)) & n64(255))),
    toU8(toI32(code & n64(255))),
  ];
  for (const b of reason) {
    out.push(b);
  }
  return out;
};

/** `count` bytes of `byte`. */
export const wtFill = (count: i32, byte: i32): u8[] => {
  const out: u8[] = new Array<u8>(count);
  out.fill(toU8(byte));
  return out;
};

/** What the server sent on one stream, in order, and how it ended. */
export class WtReceived {
  id: i64 = 0;
  data: u8[];
  fin: boolean = false;
  reset: i64 = -1;
  stop: i64 = -1;

  constructor(id: i64) {
    this.id = id;
    this.data = [];
  }
}

/** One stream the server application echoes: what came in, and how much of it went back. */
export class WtEcho {
  id: i64 = 0;
  session: i64 = 0;
  bidi: boolean = false;
  data: u8[];
  /** The stream the echo goes out on: the same one, or a new unidirectional one. */
  out: i64 = -1;
  at: i32 = 0;
  ended: boolean = false;
  done: boolean = false;

  constructor(id: i64, session: i64, bidi: boolean) {
    this.id = id;
    this.session = session;
    this.bidi = bidi;
    this.data = [];
  }
}

/** The server, the client, and the application, together. */
export class WtPeer {
  conn: QuicConnection;
  h3: Http3Connection;
  wt: WebTransport;
  c: QcClient;
  enc: QpackEncoder;
  dec: QpackDecoder;
  frame: QuicFrame;
  header: Http3FrameHeader;
  received: WtReceived[];
  /** The DATAGRAM payloads the client received, in order. */
  datagrams: u8[][];
  stopIds: i64[];
  stopCodes: i64[];
  sendIds: i64[];
  sendOffsets: i64[];
  echoes: WtEcho[];
  /** What the server application saw, one line per event. */
  log: string[];
  /** The CONNECTION_CLOSE the client received, or -1. */
  closeCode: i64 = -1;
  seen: i32 = 0;
  closeApp: boolean = false;
  /** Whether the application accepts sessions, and echoes what it gets. */
  acceptAll: boolean = true;
  echo: boolean = true;

  constructor(conn: QuicConnection, h3: Http3Connection, wt: WebTransport, c: QcClient) {
    this.conn = conn;
    this.h3 = h3;
    this.wt = wt;
    this.c = c;
    this.enc = new QpackEncoder();
    this.dec = new QpackDecoder(n32(65536));
    this.frame = new QuicFrame();
    this.header = new Http3FrameHeader();
    this.received = [];
    this.datagrams = [];
    this.stopIds = [];
    this.stopCodes = [];
    this.sendIds = [];
    this.sendOffsets = [];
    this.echoes = [];
    this.log = [];
  }

  /** The echo record of stream `id`, or `null`. */
  echoOf(id: i64): WtEcho | null {
    for (const e of this.echoes) {
      if (e.id === id || e.out === id) {
        return e;
      }
    }
    return null;
  }

  /** What the client has received on stream `id`, made empty the first time. */
  stream(id: i64): WtReceived {
    for (const r of this.received) {
      if (r.id === id) {
        return r;
      }
    }
    const fresh = new WtReceived(id);
    this.received.push(fresh);
    return fresh;
  }

  /** The client's next offset on stream `id`. */
  offsetOf(id: i64): i64 {
    for (let k: i32 = 0; k < toI32(this.sendIds.length); k++) {
      if (this.sendIds[k] === id) {
        return this.sendOffsets[k];
      }
    }
    this.sendIds.push(id);
    this.sendOffsets.push(n64(0));
    return n64(0);
  }

  /** Moves stream `id`'s offset on by `n`. */
  advance(id: i64, n: i64): void {
    for (let k: i32 = 0; k < toI32(this.sendIds.length); k++) {
      if (this.sendIds[k] === id) {
        this.sendOffsets[k] = this.sendOffsets[k] + n;
      }
    }
  }

  // ---- The server's application -------------------------------------------------

  /** Writes what echo `e` still owes, and its FIN once the client's side ended. */
  pushOut(e: WtEcho): void {
    if (e.done || !e.ended) {
      return;
    }
    if (e.out < 0) {
      e.out = e.bidi ? e.id : this.wt.openStream(e.session, false);
      if (e.out < 0) {
        e.out = -1;
        return;
      }
    }
    const n: i32 = this.wt.write(e.out, e.data, e.at, toI32(e.data.length) - e.at, true);
    if (n >= 0) {
      e.at = e.at + n;
    }
    e.done = e.at === toI32(e.data.length) && n >= 0;
  }

  /** The server application: every event handled, each logged. */
  serve(): void {
    const wt: WebTransport = this.wt;
    let event: i32 = wt.next();
    for (let guard: i32 = 0; guard < 100000 && event !== H3_NEED_MORE && event !== H3_ERROR; guard++) {
      if (event === WT_SESSION) {
        const path: string = textOf(wt.fields.path);
        this.log.push(`session ${wt.sessionId} ${path}`);
        if (path === "/no") {
          wt.refuse(wt.sessionId, n32(404));
        } else if (this.acceptAll && path !== "/hold") {
          wt.accept(wt.sessionId);
        }
      } else if (event === WT_DATAGRAM) {
        this.log.push(`datagram ${wt.sessionId} ${wt.dataLength}`);
        if (this.echo) {
          const r: i32 = wt.sendDatagram(wt.sessionId, wt.data, wt.dataStart, wt.dataLength);
          if (r !== n32(0)) {
            this.log.push(`echo refused ${r}`);
          }
        }
      } else if (event === WT_STREAM) {
        this.log.push(`stream ${wt.stream} ${wt.bidirectional ? "bidi" : "uni"} of ${wt.sessionId}`);
        this.echoes.push(new WtEcho(wt.stream, wt.sessionId, wt.bidirectional));
      } else if (event === WT_STREAM_DATA) {
        const e: WtEcho | null = this.echoOf(wt.stream);
        if (e !== null) {
          for (let k: i32 = 0; k < wt.dataLength; k++) {
            e.data.push(wt.data[wt.dataStart + k]);
          }
        }
      } else if (event === WT_STREAM_END) {
        this.log.push(`end ${wt.stream}`);
        const e: WtEcho | null = this.echoOf(wt.stream);
        if (e !== null && this.echo) {
          e.ended = true;
          this.pushOut(e);
        }
      } else if (event === WT_STREAM_RESET) {
        this.log.push(`reset ${wt.stream} 0x${h3Hex(wt.errorCode)} app ${wt.appCode}`);
      } else if (event === WT_STREAM_STOPPED) {
        this.log.push(`stopped ${wt.stream} 0x${h3Hex(wt.errorCode)} app ${wt.appCode}`);
      } else if (event === WT_WRITABLE) {
        const e: WtEcho | null = this.echoOf(wt.stream);
        if (e !== null) {
          this.pushOut(e);
        }
      } else if (event === WT_CLOSED) {
        const reason: u8[] = [];
        for (let k: i32 = 0; k < wt.dataLength; k++) {
          reason.push(wt.data[wt.dataStart + k]);
        }
        this.log.push(`closed ${wt.sessionId} ${wt.errorCode} "${textOf(reason)}"${wt.closedByPeer ? " by the client" : ""}`);
      } else if (event === WT_DRAIN) {
        this.log.push(`drain ${wt.sessionId}`);
      } else if (event === H3_REQUEST) {
        this.log.push(`request ${this.h3.stream} ${textOf(this.h3.fields.path)}`);
        const none: u8[][] = [];
        this.h3.respond(this.h3.stream, n32(404), none, none, true);
      } else if (event === H3_DATA || event === H3_END) {
        this.log.push(`plain ${event} ${this.h3.stream}`);
      } else {
        this.log.push(`event ${event} ${this.h3.stream}`);
      }
      event = wt.next();
    }
    if (event === H3_ERROR) {
      this.log.push(`error 0x${h3Hex(this.h3.errorCode)}`);
    }
  }

  // ---- The client ---------------------------------------------------------------

  /** Reads every packet the client opened since the last call. */
  absorb(): void {
    while (this.seen < toI32(this.c.appPayloads.length)) {
      const payload: u8[] = this.c.appPayloads[this.seen];
      this.seen = this.seen + 1;
      let at: i32 = 0;
      while (at < toI32(payload.length)) {
        const f: QuicFrame = this.frame;
        if (quicParseFrame(f, payload, at, toI32(payload.length)) !== n64(0) || f.end <= at) {
          break;
        }
        if (f.type === QUIC_FRAME_STREAM) {
          const r: WtReceived = this.stream(f.streamId);
          const have: i64 = toI64(toI32(r.data.length));
          if (f.offset <= have) {
            const skip: i32 = toI32(have - f.offset);
            for (let k: i32 = skip; k < f.dataLength; k++) {
              r.data.push(payload[f.dataStart + k]);
            }
            r.fin = r.fin || (f.fin && f.offset + toI64(f.dataLength) <= toI64(toI32(r.data.length)));
          }
        } else if (f.type === QUIC_FRAME_DATAGRAM) {
          const d: u8[] = [];
          for (let k: i32 = 0; k < f.dataLength; k++) {
            d.push(payload[f.dataStart + k]);
          }
          this.datagrams.push(d);
        } else if (f.type === QUIC_FRAME_RESET_STREAM) {
          this.stream(f.streamId).reset = f.errorCode;
        } else if (f.type === QUIC_FRAME_STOP_SENDING) {
          const r: WtReceived = this.stream(f.streamId);
          if (r.stop < 0) {
            this.stopIds.push(f.streamId);
            this.stopCodes.push(f.errorCode);
          }
          r.stop = f.errorCode;
        } else if (f.type === QUIC_FRAME_CONNECTION_CLOSE || f.type === QUIC_FRAME_CONNECTION_CLOSE_APP) {
          this.closeCode = f.errorCode;
          this.closeApp = f.type === QUIC_FRAME_CONNECTION_CLOSE_APP;
        }
        at = f.end;
      }
    }
  }

  /** The client acknowledges every packet it has from the server. */
  ack(): void {
    if (this.c.largestApp < 0) {
      return;
    }
    const ack: u8[] = [];
    quicPushAck(ack, [n64(0), this.c.largestApp], n32(1), n64(0));
    this.packet(ack);
  }

  /** One 1-RTT packet of `payload` to the server, the server's application run, and what it sends read. */
  packet(payload: u8[]): void {
    qcExchange(this.conn, this.c, qcShort(this.c, payload));
    this.serve();
    qcDrain(this.conn, this.c);
    this.absorb();
    if (toI32(this.stopIds.length) > 0) {
      const resets: u8[] = [];
      while (toI32(this.stopIds.length) > 0) {
        const id: i64 = this.stopIds.pop();
        const code: i64 = this.stopCodes.pop();
        quicPushStreamError(resets, id, code, this.offsetOf(id));
      }
      this.packet(resets);
    }
  }

  /** Acknowledges and runs the server until it has nothing more to send. */
  settle(): void {
    for (let k: i32 = 0; k < 64; k++) {
      const before: i32 = toI32(this.c.appPayloads.length);
      this.ack();
      if (toI32(this.c.appPayloads.length) === before) {
        return;
      }
    }
  }

  /** How many bytes the server lets the client send on stream `id` now. */
  credit(id: i64): i64 {
    const s = this.conn.streams.find(id);
    const offset: i64 = this.offsetOf(id);
    const streams = this.conn.streams;
    const connection: i64 = streams.recvMaxData - streams.recvTotal;
    if (s === null) {
      const initial: i64 = streams.bufferSize > 0 ? toI64(streams.bufferSize) : n64(0);
      return initial - offset < connection ? initial - offset : connection;
    }
    const own: i64 = s.recvLimit - offset;
    return own < connection ? own : connection;
  }

  /** Sends all of `bytes` on stream `id`, and the FIN after it when `fin`, within the server's credit. */
  send(id: i64, bytes: u8[], fin: boolean): boolean {
    let at: i32 = 0;
    const total: i32 = toI32(bytes.length);
    for (let rounds: i32 = 0; rounds < 100000; rounds++) {
      if (this.stream(id).stop >= 0) {
        return false;
      }
      const credit: i64 = this.credit(id);
      let n: i32 = total - at;
      if (n > CHUNK) {
        n = CHUNK;
      }
      if (toI64(n) > credit) {
        n = credit > 0 ? toI32(credit) : n32(0);
      }
      const last: boolean = at + n === total;
      if (n > 0 || (last && fin)) {
        const payload: u8[] = [];
        quicPushStream(payload, id, this.offsetOf(id), bytes, at, n, last && fin);
        this.advance(id, toI64(n));
        at = at + n;
        this.packet(payload);
        if (last) {
          return true;
        }
      } else {
        this.ack();
      }
    }
    return false;
  }

  /** The client's control stream with SETTINGS `ids`/`values`, and its QPACK streams. */
  openWith(ids: i64[], values: i64[]): void {
    this.send(WT_CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), wtSettingsFrame(ids, values)]), false);
    this.send(WT_CLIENT_ENCODER, h3Varint(H3_STREAM_QPACK_ENCODER), false);
    this.send(WT_CLIENT_DECODER, h3Varint(H3_STREAM_QPACK_DECODER), false);
  }

  /** The client's streams opened with `wtransport`'s SETTINGS. */
  open(): void {
    this.openWith(wtClientSettingIds(), wtClientSettingValues());
  }

  /** The HEADERS frame of an extended CONNECT for `path` with `:protocol` `protocol` and `:scheme` `scheme`. */
  connectFrame(path: string, protocol: string, scheme: string): u8[] {
    return h3Frame(
      H3_FRAME_HEADERS,
      h3Section(
        this.enc,
        [":method", ":scheme", ":authority", ":path", ":protocol", "origin"],
        ["CONNECT", scheme, "localhost", path, protocol, "https://localhost"],
      ),
    );
  }

  /** Asks for a WebTransport session on stream `id` for `path`. */
  session(id: i64, path: string): void {
    this.send(id, this.connectFrame(path, "webtransport", "https"), false);
  }

  /** The status the server answered stream `id` with, or "". */
  status(id: i64): string {
    const r: WtReceived = this.stream(id);
    const n: i32 = toI32(r.data.length);
    const size: i32 = h3ReadFrameHeader(this.header, r.data, n32(0), n);
    if (size === 0 || this.header.type !== H3_FRAME_HEADERS || size + toI32(this.header.length) > n) {
      return "";
    }
    if (this.dec.decode(r.data, size, toI32(this.header.length)) !== QPACK_OK) {
      return "";
    }
    let out: string = "";
    for (let k: i32 = 0; k < this.dec.count; k++) {
      const name: string = this.text(this.dec.nameStart[k], this.dec.nameLength[k]);
      const value: string = this.text(this.dec.valueStart[k], this.dec.valueLength[k]);
      out = out.length === 0 ? `${name}: ${value}` : `${out}; ${name}: ${value}`;
    }
    return out;
  }

  /** The decoder's bytes as text. */
  text(start: i32, length: i32): string {
    const out: u8[] = [];
    for (let k: i32 = start; k < start + length; k++) {
      out.push(this.dec.bytes[k]);
    }
    return textOf(out);
  }

  /** The payloads of the DATA frames the server sent on CONNECT stream `id`: its capsules. */
  capsules(id: i64): u8[] {
    const r: WtReceived = this.stream(id);
    const out: u8[] = [];
    let at: i32 = 0;
    const n: i32 = toI32(r.data.length);
    while (at < n) {
      const size: i32 = h3ReadFrameHeader(this.header, r.data, at, n - at);
      if (size === 0) {
        return out;
      }
      const start: i32 = at + size;
      const length: i32 = toI32(this.header.length);
      if (this.header.type === H3_FRAME_DATA) {
        for (let k: i32 = start; k < start + length && k < n; k++) {
          out.push(r.data[k]);
        }
      }
      at = start + length;
    }
    return out;
  }

  /** Sends capsule bytes `bytes` in one DATA frame on CONNECT stream `id`. */
  capsule(id: i64, bytes: u8[], fin: boolean): void {
    this.send(id, h3Frame(H3_FRAME_DATA, bytes), fin);
  }

  /** One HTTP datagram of session `session`: the quarter stream ID, then `payload`, as one DATAGRAM frame. */
  datagram(session: i64, payload: u8[]): void {
    this.rawDatagram(h3Cat([h3Varint(session >> n64(2)), payload]));
  }

  /** A DATAGRAM frame carrying `data` as it is. */
  rawDatagram(data: u8[]): void {
    const size: i32 = quicDatagramSize(toI32(data.length));
    const frame: u8[] = new Array<u8>(size);
    quicPutDatagram(frame, n32(0), size, data, n32(0), toI32(data.length));
    this.packet(frame);
  }

  /** Opens the client's bidirectional stream `id` for session `session`, then `bytes`. */
  bidi(id: i64, session: i64, bytes: u8[], fin: boolean): void {
    this.send(id, h3Cat([h3Varint(H3_FRAME_WEBTRANSPORT_STREAM), h3Varint(session), bytes]), fin);
  }

  /** Opens the client's unidirectional stream `id` for session `session`, then `bytes`. */
  uni(id: i64, session: i64, bytes: u8[], fin: boolean): void {
    this.send(id, h3Cat([h3Varint(H3_STREAM_WEBTRANSPORT), h3Varint(session), bytes]), fin);
  }

  /** RESET_STREAM of the client's side of `id` with `code`. */
  resetStream(id: i64, code: i64): void {
    const payload: u8[] = [];
    quicPushStreamError(payload, id, code, this.offsetOf(id));
    this.packet(payload);
  }

  /** STOP_SENDING for `id` with `code`. */
  stopSending(id: i64, code: i64): void {
    const payload: u8[] = [];
    quicPushStreamError(payload, id, code, n64(-1));
    this.packet(payload);
  }
}

/** A connected pair under `limits`; the client's own streams are not open yet. */
export const wtConnect = (limits: WtLimits): WtPeer => {
  const conn = new QuicConnection(wtQuicConfig(limits), fixedEntropy());
  const h3 = new Http3Connection(wtH3Config(limits), conn);
  const wt = new WebTransport(wtConfig(limits), h3);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  qcConnect(conn, c, qcHello([TLS_AES_128_GCM_SHA256], H3_ALPN, wtClientParams(limits)));
  const p = new WtPeer(conn, h3, wt, c);
  p.serve();
  qcDrain(conn, c);
  p.absorb();
  return p;
};

/** A connected pair with the client's streams and SETTINGS sent, and a session accepted on stream 0. */
export const wtReady = (limits: WtLimits): WtPeer => {
  const p: WtPeer = wtConnect(limits);
  p.open();
  p.session(n64(0), "/echo");
  p.settle();
  return p;
};

/** Whether the server's application logged `line`. */
export const wtSaw = (p: WtPeer, line: string): boolean => toI32(p.log.indexOf(line)) >= 0;

/** Checks the application logged `want`, in order, and says which was missing. */
export const wtLogged = (t: Suite, name: string, p: WtPeer, want: string[]): boolean => {
  let at: i32 = 0;
  for (const line of p.log) {
    if (at < toI32(want.length) && line === want[at]) {
      at++;
    }
  }
  if (at === toI32(want.length)) {
    return t.ok(name, true);
  }
  return t.eqStr(name, `missing "${want[at]}" in: ${p.log.join(" | ")}`, "");
};

/** The bytes `bytes` as lowercase hexadecimal. */
export const wtHexOf = (bytes: u8[]): string => {
  const digits: string = "0123456789abcdef";
  let out: string = "";
  for (const b of bytes) {
    const v: i32 = toI32(b);
    out = `${out}${digits.slice(v >> 4, (v >> 4) + 1)}${digits.slice(v & 15, (v & 15) + 1)}`;
  }
  return out;
};

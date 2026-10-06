// What the HTTP/3 checks start from: a server — a `QuicConnection` with an
// `Http3Connection` over it, and a small application that answers a few
// paths — and the client half that talks to it, sans-IO. The client is
// `tests/link/net_quic_conn/client`'s QUIC client, whose handshake and packet
// protection are pinned against RFC 8448 and RFC 9001, with HTTP/3 written on
// top by hand: its frames are `nish/net/http3-frame`'s writers, its field
// sections `nish/net/qpack`'s encoder, and what the server sends is read back
// from the STREAM, RESET_STREAM, STOP_SENDING and CONNECTION_CLOSE frames of
// every packet the client opens. `loopback.ts` drives the same client over a
// UDP socket instead.
import { netAddress, udpBind, udpRecvFrom, udpSendTo } from "nish:net";
import { Secret, secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";
import {
  QUIC_FRAME_CONNECTION_CLOSE,
  QUIC_FRAME_CONNECTION_CLOSE_APP,
  QUIC_FRAME_RESET_STREAM,
  QUIC_FRAME_STOP_SENDING,
  QUIC_FRAME_STREAM,
  QuicFrame,
  quicParseFrame,
  quicPushAck,
  quicPushStream,
  quicPushStreamError,
} from "nish/net/quic-frame";
import { QuicTransportParameters, quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QuicConnection, QuicServerConfig } from "nish/net/quic";
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { QPACK_OK, QpackDecoder, QpackEncoder } from "nish/net/qpack";
import {
  H3_FRAME_DATA,
  H3_FRAME_HEADERS,
  H3_FRAME_SETTINGS,
  H3_SETTINGS_MAX_FIELD_SECTION_SIZE,
  H3_STREAM_CONTROL,
  H3_STREAM_QPACK_DECODER,
  H3_STREAM_QPACK_ENCODER,
  Http3FrameHeader,
  h3PutFrameHeader,
  h3PutSettings,
  h3PutVarint,
  h3ReadFrameHeader,
} from "nish/net/http3-frame";
import {
  H3_ALPN,
  H3_DATA,
  H3_END,
  H3_ERROR,
  H3_GOAWAY,
  H3_NEED_MORE,
  H3_REQUEST,
  H3_RESET,
  H3_TRAILERS,
  H3_WRITABLE,
  Http3Config,
  Http3Connection,
} from "nish/net/http3";
import { Http3Server } from "nish/net/http3-server";
import { leafCertificate, leafPrivate } from "../net_tls_common/server";
import { bytesOf, fromHex, textOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { fixedEntropy, resetKey, tokenKey } from "../net_quic_conn_replay/server";
import {
  CLIENT_SCID,
  QcClient,
  qcConnect,
  qcCrypto,
  qcDrain,
  qcExchange,
  qcFinishedPacket,
  qcHello,
  qcInitial,
  qcReadFlight,
  qcReceive,
  qcShort,
} from "../net_quic_conn/client";

/** The client's three unidirectional streams: control, QPACK encoder, QPACK decoder. */
export const CLIENT_CONTROL: i64 = 2;
export const CLIENT_ENCODER: i64 = 6;
export const CLIENT_DECODER: i64 = 10;
/** The server's: its first three unidirectional streams. */
export const SERVER_CONTROL: i64 = 3;

/** The most stream bytes the client puts in one packet. */
const CHUNK: i32 = 1000;

/** What a case configures: the QUIC limits under the HTTP/3 connection. */
export class H3Limits {
  maxData: i64 = 1048576;
  maxStreamData: i64 = 32768;
  maxStreamsBidi: i64 = 16;
  maxStreamsUni: i64 = 4;
  localStreams: i64 = 3;
  /** The client's transport parameters: what it lets the server send, and open. */
  clientUniStreams: i64 = 8;
  alpn: string = "h3";
}

/**
 * The HTTP/3 configuration every check uses: the defaults, with a
 * field-section cap of 8,192, which half of the 32 KiB stream buffers of
 * `H3Limits` can hold with a frame header (the constructor checks it).
 */
export const h3Config = (): Http3Config => {
  const config = new Http3Config();
  config.maxFieldSectionSize = n32(8192);
  return config;
};

/** The QUIC configuration of `limits`, offering `h3`. */
export const h3QuicConfig = (limits: H3Limits): QuicServerConfig => {
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
    maxDatagramFrameSize: n64(0),
    maxIdleTimeout: n64(30000),
    activeConnectionIdLimit: n64(4),
    statelessResetKey: resetKey(),
    retryTokenKey: tokenKey(),
    retry: false,
    retryTokenLifetime: n64(10000),
  };
};

/** The client's transport parameters: generous credit for whatever the server sends. */
export const h3ClientParams = (limits: H3Limits): u8[] => {
  const p = new QuicTransportParameters();
  p.initialScid = fromHex(CLIENT_SCID);
  p.hasInitialScid = true;
  p.initialMaxData = n64(67108864);
  p.initialMaxStreamDataBidiLocal = n64(16777216);
  p.initialMaxStreamDataBidiRemote = n64(65536);
  p.initialMaxStreamDataUni = n64(65536);
  p.initialMaxStreamsBidi = n64(0);
  p.initialMaxStreamsUni = limits.clientUniStreams;
  p.activeConnectionIdLimit = n64(4);
  return quicEncodeTransportParameters(p);
};

/** The ClientHello of `limits`, offering ALPN `limits.alpn`. */
export const h3Hello = (limits: H3Limits): u8[] => qcHello([TLS_AES_128_GCM_SHA256], limits.alpn, h3ClientParams(limits));

/** `value` in lowercase hexadecimal, without a prefix. */
export const h3Hex = (value: i64): string => {
  const digits: string = "0123456789abcdef";
  if (value <= 0) {
    return "0";
  }
  let out: string = "";
  let v: i64 = value;
  while (v > 0) {
    const d: i32 = toI32(v & n64(15));
    out = `${digits.slice(d, d + 1)}${out}`;
    v = v >> n64(4);
  }
  return out;
};

/** `count` bytes of a pattern a check can verify at any offset: byte `k` is `k * 7 + k / 251` modulo 256. */
export const h3Pattern = (count: i32): u8[] => {
  const out: u8[] = new Array<u8>(count);
  for (let k: i32 = 0; k < count && k < toI32(out.length); k++) {
    out[k] = toU8((k * 7 + k / 251) & 255);
  }
  return out;
};

/** Whether `bytes` is `h3Pattern(bytes.length)`. */
export const h3IsPattern = (bytes: u8[]): boolean => {
  const want: u8[] = h3Pattern(toI32(bytes.length));
  for (let k: i32 = 0; k < toI32(bytes.length) && k < toI32(want.length); k++) {
    if (bytes[k] !== want[k]) {
      return false;
    }
  }
  return true;
};

/** A field section of `names` and `values`, QPACK-encoded the way the client's encoder does. */
export const h3Section = (enc: QpackEncoder, names: string[], values: string[]): u8[] => {
  const out: u8[] = [];
  enc.beginSection(out);
  for (let k: i32 = 0; k < toI32(names.length) && k < toI32(values.length); k++) {
    const name: u8[] = bytesOf(names[k]);
    const value: u8[] = bytesOf(values[k]);
    enc.encodeField(out, name, n32(0), toI32(name.length), value, n32(0), toI32(value.length), false, true);
  }
  return out;
};

/** A frame of `type` carrying `payload`, as bytes. */
export const h3Frame = (type: i64, payload: u8[]): u8[] => {
  const head: u8[] = new Array<u8>(16);
  const n: i32 = h3PutFrameHeader(head, n32(0), n32(16), type, toI64(toI32(payload.length)));
  const out: u8[] = [];
  for (let k: i32 = 0; k < n; k++) {
    out.push(head[k]);
  }
  for (const b of payload) {
    out.push(b);
  }
  return out;
};

/** A varint, as bytes. */
export const h3Varint = (value: i64): u8[] => {
  const buf: u8[] = new Array<u8>(8);
  const n: i32 = h3PutVarint(buf, n32(0), n32(8), value);
  const out: u8[] = [];
  for (let k: i32 = 0; k < n; k++) {
    out.push(buf[k]);
  }
  return out;
};

/** `parts` joined. */
export const h3Cat = (parts: u8[][]): u8[] => {
  const out: u8[] = [];
  for (const part of parts) {
    for (const b of part) {
      out.push(b);
    }
  }
  return out;
};

/** The client's SETTINGS frame: SETTINGS_MAX_FIELD_SECTION_SIZE `max` (-1 for none) and one reserved identifier, 0x21, which the server must ignore. */
export const h3ClientSettings = (max: i64): u8[] => {
  const ids: i64[] = [n64(0x21)];
  const values: i64[] = [n64(7)];
  if (max >= 0) {
    ids.push(H3_SETTINGS_MAX_FIELD_SECTION_SIZE);
    values.push(max);
  }
  const buf: u8[] = new Array<u8>(64);
  const n: i32 = h3PutSettings(buf, n32(0), n32(64), ids, values);
  const out: u8[] = [];
  for (let k: i32 = 0; k < n; k++) {
    out.push(buf[k]);
  }
  return out;
};

/** What the server sent on one stream, put back in order, and how it ended. */
export class H3Received {
  id: i64 = 0;
  data: u8[];
  fin: boolean = false;
  /** The server's RESET_STREAM code, and its STOP_SENDING code, or -1. */
  reset: i64 = -1;
  stop: i64 = -1;

  constructor(id: i64) {
    this.id = id;
    this.data = [];
  }
}

/** A response read back from what the server sent on a request stream. */
export class H3Response {
  status: string = "";
  /** The response's other fields as `name: value` lines joined with `; `, and its trailers the same way. */
  fields: string = "";
  trailers: string = "";
  body: u8[];
  /** How many DATA frames carried the body, and the largest. */
  frames: i32 = 0;
  largest: i32 = 0;
  fin: boolean = false;
  /** Whether the bytes parsed as whole frames. */
  whole: boolean = false;

  constructor() {
    this.body = [];
  }
}

/** One stream the server application is answering. */
export class H3AppStream {
  id: i64 = 0;
  path: string = "";
  /** The response body still to write, from `at`. */
  out: u8[];
  at: i32 = 0;
  /** Bytes of request body received, and the largest piece. */
  received: i64 = 0;
  largest: i32 = 0;
  /** Whether the FIN goes once `out` is written, and whether it went. */
  finPending: boolean = false;
  finished: boolean = false;
  responded: boolean = false;

  constructor(id: i64, path: string) {
    this.id = id;
    this.path = path;
    this.out = [];
  }
}

/**
 * The client's socket, when the peer talks to an `Http3Server` over UDP
 * instead of handing datagrams to a `QuicConnection` itself: every datagram
 * goes out of it to the server's port, and `H3Peer.pump` runs the server's
 * loop and reads what comes back.
 */
export class H3Wire {
  server: Http3Server;
  to: u8[];
  rx: u8[];
  from: u8[];
  meta: i32[];
  fd: i32 = -1;
  /** The server's slot the client's connection is in, once accepted. */
  slot: i32 = -1;

  constructor(server: Http3Server, port: i32) {
    this.server = server;
    this.fd = udpBind("127.0.0.1", n32(0), n32(0));
    this.to = new Array<u8>(18);
    netAddress(this.to, "127.0.0.1", port);
    this.rx = new Array<u8>(65536);
    this.from = new Array<u8>(18);
    this.meta = [n32(0), n32(0)];
  }
}

/** The server, the client, and the application, together. */
export class H3Peer {
  conn: QuicConnection;
  h3: Http3Connection;
  c: QcClient;
  enc: QpackEncoder;
  dec: QpackDecoder;
  frame: QuicFrame;
  header: Http3FrameHeader;
  received: H3Received[];
  /** STOP_SENDING the server sent that the client has not answered with RESET_STREAM yet (RFC 9000 §3.5). */
  stopIds: i64[];
  stopCodes: i64[];
  /** The client's next offset on each stream it writes. */
  sendIds: i64[];
  sendOffsets: i64[];
  apps: H3AppStream[];
  /** What the server application saw, one line per event. */
  log: string[];
  /** The fields every response carries. */
  names: u8[][];
  values: u8[][];
  /** The CONNECTION_CLOSE the client received: its code, and whether it was the application's; -1 until one comes. */
  closeCode: i64 = -1;
  /** How many of `c.appPayloads` the client has read. */
  seen: i32 = 0;
  closeApp: boolean = false;
  /** How many H3_WRITABLE events the application saw. */
  writables: i32 = 0;
  /** Whether the application holds every `/hold` response back. */
  hold: boolean = true;
  /** The client's socket, when the server is an `Http3Server` across loopback. */
  wire: H3Wire | null = null;

  constructor(conn: QuicConnection, h3: Http3Connection, c: QcClient) {
    this.conn = conn;
    this.h3 = h3;
    this.c = c;
    this.enc = new QpackEncoder();
    this.dec = new QpackDecoder(n32(65536));
    this.frame = new QuicFrame();
    this.header = new Http3FrameHeader();
    this.received = [];
    this.sendIds = [];
    this.sendOffsets = [];
    this.stopIds = [];
    this.stopCodes = [];
    this.apps = [];
    this.log = [];
    this.names = [bytesOf("content-type"), bytesOf("server")];
    this.values = [bytesOf("text/plain"), bytesOf("nish")];
  }

  /** The application's state for stream `id`, or `null`. */
  app(id: i64): H3AppStream | null {
    for (const s of this.apps) {
      if (s.id === id) {
        return s;
      }
    }
    return null;
  }

  /** What the client has received on stream `id`, made empty the first time. */
  stream(id: i64): H3Received {
    for (const r of this.received) {
      if (r.id === id) {
        return r;
      }
    }
    const fresh = new H3Received(id);
    this.received.push(fresh);
    return fresh;
  }

  /** The client's next offset on stream `id`, and its record. */
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

  /** Writes what stream `s` still owes, as far as the server takes it, and the FIN after it. */
  pushOut(s: H3AppStream): void {
    if (s.finished) {
      return;
    }
    while (s.at < toI32(s.out.length)) {
      const n: i32 = this.h3.writeData(s.id, s.out, s.at, toI32(s.out.length) - s.at, s.finPending);
      if (n <= 0) {
        return;
      }
      s.at = s.at + n;
    }
    if (s.finPending) {
      const none: u8[] = [];
      if (this.h3.writeData(s.id, none, n32(0), n32(0), true) === 0 || s.at > 0) {
        s.finished = true;
      }
    }
  }

  /** Answers the request on `s` once it has ended, by its path. */
  answer(s: H3AppStream): void {
    if (s.path === "/hello") {
      this.h3.respond(s.id, n32(200), this.names, this.values, false);
      s.responded = true;
      s.out = bytesOf("hello, h3");
      s.finPending = true;
      this.pushOut(s);
    } else if (s.path === "/trailers") {
      this.h3.respond(s.id, n32(200), this.names, this.values, false);
      s.responded = true;
      const body: u8[] = bytesOf("with trailers");
      this.h3.writeData(s.id, body, n32(0), toI32(body.length), false);
      const tn: u8[][] = [bytesOf("x-checksum"), bytesOf("x-count")];
      const tv: u8[][] = [bytesOf("abc123"), bytesOf(`${s.received}`)];
      const result: i32 = this.h3.writeTrailers(s.id, tn, tv);
      s.finished = result === 0;
    } else if (s.path === "/hold") {
      if (!this.hold) {
        this.h3.respond(s.id, n32(200), this.names, this.values, false);
        s.responded = true;
        s.out = bytesOf("released");
        s.finPending = true;
        this.pushOut(s);
      }
    } else if (!s.responded) {
      const none: u8[][] = [];
      this.h3.respond(s.id, n32(404), none, none, true);
      s.responded = true;
      s.finished = true;
    }
  }

  /** The server application: every event the connection has, handled. */
  serve(): void {
    let event: i32 = this.h3.next();
    for (let guard: i32 = 0; guard < 100000 && event !== H3_NEED_MORE && event !== H3_ERROR; guard++) {
      const id: i64 = this.h3.stream;
      if (event === H3_REQUEST) {
        const path: string = textOf(this.h3.fields.path);
        const s = new H3AppStream(id, path);
        this.apps.push(s);
        this.log.push(`request ${id} ${textOf(this.h3.fields.method)} ${path}`);
        if (path === "/echo") {
          this.h3.respond(id, n32(200), this.names, this.values, false);
          s.responded = true;
        } else if (path.startsWith("/big/")) {
          this.h3.respond(id, n32(200), this.names, this.values, false);
          s.responded = true;
          s.out = h3Pattern(parseInt(path.slice(n32(5))));
          s.finPending = true;
          this.pushOut(s);
        }
      } else if (event === H3_DATA) {
        const s: H3AppStream | null = this.app(id);
        if (s !== null) {
          s.received = s.received + toI64(this.h3.dataLength);
          if (this.h3.dataLength > s.largest) {
            s.largest = this.h3.dataLength;
          }
          if (s.path === "/echo") {
            for (let k: i32 = 0; k < this.h3.dataLength; k++) {
              s.out.push(this.h3.data[this.h3.dataStart + k]);
            }
            this.pushOut(s);
          }
        }
      } else if (event === H3_TRAILERS) {
        const parts: string[] = [];
        for (let k: i32 = 0; k < toI32(this.h3.fields.names.length); k++) {
          parts.push(`${textOf(this.h3.fields.names[k])}=${textOf(this.h3.fields.values[k])}`);
        }
        this.log.push(`trailers ${id} ${parts.join(" ")}`);
      } else if (event === H3_END) {
        const s: H3AppStream | null = this.app(id);
        this.log.push(`end ${id}`);
        if (s !== null) {
          if (s.path === "/echo") {
            s.finPending = true;
            this.pushOut(s);
          } else if (!s.responded) {
            this.answer(s);
          }
        }
      } else if (event === H3_RESET) {
        this.log.push(`reset ${id} 0x${h3Hex(this.h3.errorCode)}${this.h3.resetByPeer ? " by the client" : ""}`);
      } else if (event === H3_WRITABLE) {
        this.writables = this.writables + 1;
        const s: H3AppStream | null = this.app(id);
        if (s !== null) {
          this.pushOut(s);
        }
      } else if (event === H3_GOAWAY) {
        this.log.push(`goaway ${this.h3.lastStreamId}`);
      }
      event = this.h3.next();
    }
    if (event === H3_ERROR) {
      this.log.push(`error 0x${h3Hex(this.h3.errorCode)}`);
    }
  }

  /** Releases every held `/hold` response. */
  release(): void {
    this.hold = false;
    for (const s of this.apps) {
      if (s.path === "/hold" && !s.responded) {
        this.answer(s);
      }
    }
  }

  // ---- The client ---------------------------------------------------------------

  /** Reads every packet the client opened since the last call into the per-stream records. */
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
          const r: H3Received = this.stream(f.streamId);
          const have: i64 = toI64(toI32(r.data.length));
          if (f.offset <= have) {
            const skip: i32 = toI32(have - f.offset);
            for (let k: i32 = skip; k < f.dataLength; k++) {
              r.data.push(payload[f.dataStart + k]);
            }
            r.fin = r.fin || (f.fin && f.offset + toI64(f.dataLength) <= toI64(toI32(r.data.length)));
          }
        } else if (f.type === QUIC_FRAME_RESET_STREAM) {
          this.stream(f.streamId).reset = f.errorCode;
        } else if (f.type === QUIC_FRAME_STOP_SENDING) {
          const r: H3Received = this.stream(f.streamId);
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
    const wire: H3Wire | null = this.wire;
    if (wire !== null) {
      this.transmit(wire, qcShort(this.c, payload));
    } else {
      qcExchange(this.conn, this.c, qcShort(this.c, payload));
      this.serve();
      qcDrain(this.conn, this.c);
      this.absorb();
    }
    // A QUIC client answers STOP_SENDING with RESET_STREAM.
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

  /** Sends `datagram` from the client's socket and runs the loop until both sides are quiet. */
  transmit(wire: H3Wire, datagram: u8[]): void {
    udpSendTo(wire.fd, datagram, n32(0), toI32(datagram.length), wire.to, n32(0), n32(0));
    this.pump(wire);
  }

  /**
   * The server's loop and the client's reads, round after round: the server
   * takes what arrived, runs its timers, serves every ready slot (this
   * peer's with its application, any other by reading its events) and
   * flushes; the client reads what came back. The clock moves a millisecond
   * a round, and up to the server's next timer when nothing moved, so the
   * pacer lets a long response out.
   */
  pump(wire: H3Wire): void {
    const server: Http3Server = wire.server;
    for (let round: i32 = 0; round < 2000; round++) {
      const key: Secret<u8[]> = secret(leafPrivate());
      const got: i32 = server.receive(this.c.now, key);
      wipe(key);
      server.tick(this.c.now);
      let slot: i32 = server.ready();
      while (slot >= 0) {
        if (wire.slot < 0) {
          wire.slot = slot;
          this.conn = server.quic(slot);
          this.h3 = server.connection(slot);
        }
        if (slot === wire.slot) {
          this.serve();
        } else {
          let event: i32 = server.connection(slot).next();
          while (event !== H3_NEED_MORE && event !== H3_ERROR) {
            event = server.connection(slot).next();
          }
        }
        slot = server.ready();
      }
      server.flush(this.c.now);
      let read: i32 = 0;
      let n: i32 = udpRecvFrom(wire.fd, wire.rx, n32(0), n32(65536), wire.from, wire.meta);
      while (n >= 0) {
        const datagram: u8[] = [];
        for (let k: i32 = 0; k < n; k++) {
          datagram.push(wire.rx[k]);
        }
        this.c.datagrams.push(datagram);
        qcReceive(this.c, datagram);
        read++;
        n = udpRecvFrom(wire.fd, wire.rx, n32(0), n32(65536), wire.from, wire.meta);
      }
      this.absorb();
      if (got === 0 && read === 0) {
        const wait: i32 = server.timeout(this.c.now);
        if (wait < 0 || wait > 50) {
          return;
        }
        this.c.now = this.c.now + toI64(wait > 0 ? wait : n32(1));
      } else {
        this.c.now = this.c.now + n64(1);
      }
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

  /** How many bytes the server lets the client send on stream `id` now, from what the server's own records say. */
  credit(id: i64): i64 {
    const s = this.conn.streams.find(id);
    const offset: i64 = this.offsetOf(id);
    const streams = this.conn.streams;
    const connection: i64 = streams.recvMaxData - streams.recvTotal;
    if (s === null) {
      // Not open yet: a new stream gets the initial credit.
      const initial: i64 = streams.bufferSize > 0 ? toI64(streams.bufferSize) : n64(0);
      return initial - offset < connection ? initial - offset : connection;
    }
    const own: i64 = s.recvLimit - offset;
    return own < connection ? own : connection;
  }

  /**
   * Sends all of `bytes` on stream `id`, and the FIN after it when `fin`: in
   * packets of at most 1,000 bytes, each within the credit the server gave,
   * running the server between them so that reading it gives more.
   */
  send(id: i64, bytes: u8[], fin: boolean): boolean {
    let at: i32 = 0;
    const total: i32 = toI32(bytes.length);
    for (let rounds: i32 = 0; rounds < 100000; rounds++) {
      if (this.stream(id).stop >= 0) {
        // The server asked the client to stop, and the client reset the stream: nothing more goes.
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
        // No credit: acknowledge, so the server sends the MAX_STREAM_DATA its reading owes.
        this.ack();
      }
    }
    return false;
  }

  /** The client's control stream with its SETTINGS, and its QPACK streams, opened. */
  open(max: i64): void {
    this.send(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3ClientSettings(max)]), false);
    this.send(CLIENT_ENCODER, h3Varint(H3_STREAM_QPACK_ENCODER), false);
    this.send(CLIENT_DECODER, h3Varint(H3_STREAM_QPACK_DECODER), false);
  }

  /** A request's HEADERS frame: `method` on `path`, with `more` fields after the pseudo-headers. */
  headers(method: string, path: string, moreNames: string[], moreValues: string[]): u8[] {
    const names: string[] = [":method", ":scheme", ":authority", ":path"];
    const values: string[] = [method, "https", "localhost", path];
    for (let k: i32 = 0; k < toI32(moreNames.length) && k < toI32(moreValues.length); k++) {
      names.push(moreNames[k]);
      values.push(moreValues[k]);
    }
    return h3Frame(H3_FRAME_HEADERS, h3Section(this.enc, names, values));
  }

  /** A GET of `path` on stream `id`, whole, with its FIN. */
  get(id: i64, path: string): void {
    const none: string[] = [];
    this.send(id, this.headers("GET", path, none, none), true);
  }

  /** Sends a RESET_STREAM of the client's side of `id` with `code` at final size `size`, and STOP_SENDING with `code`. */
  cancel(id: i64, code: i64): void {
    const payload: u8[] = [];
    quicPushStreamError(payload, id, code, this.offsetOf(id));
    quicPushStreamError(payload, id, code, n64(-1));
    this.packet(payload);
  }

  /** RESET_STREAM of the client's side of `id` with `code`, alone. */
  cancelOnly(id: i64, code: i64): void {
    const payload: u8[] = [];
    quicPushStreamError(payload, id, code, this.offsetOf(id));
    this.packet(payload);
  }

  /** STOP_SENDING for `id` with `code`, alone. */
  stopOnly(id: i64, code: i64): void {
    const payload: u8[] = [];
    quicPushStreamError(payload, id, code, n64(-1));
    this.packet(payload);
  }

  /** The response the server sent on stream `id`, read from its frames. */
  response(id: i64): H3Response {
    const out = new H3Response();
    const r: H3Received = this.stream(id);
    out.fin = r.fin;
    let at: i32 = 0;
    let heads: i32 = 0;
    const n: i32 = toI32(r.data.length);
    while (at < n) {
      const size: i32 = h3ReadFrameHeader(this.header, r.data, at, n - at);
      if (size === 0) {
        return out;
      }
      const length: i32 = toI32(this.header.length);
      const start: i32 = at + size;
      if (start + length > n) {
        return out;
      }
      if (this.header.type === H3_FRAME_HEADERS) {
        if (this.dec.decode(r.data, start, length) !== QPACK_OK) {
          return out;
        }
        const lines: string[] = [];
        for (let k: i32 = 0; k < this.dec.count; k++) {
          const name: string = this.text(this.dec.nameStart[k], this.dec.nameLength[k]);
          const value: string = this.text(this.dec.valueStart[k], this.dec.valueLength[k]);
          if (name === ":status") {
            out.status = value;
          } else {
            lines.push(`${name}: ${value}`);
          }
        }
        if (heads === 0) {
          out.fields = lines.join("; ");
        } else {
          out.trailers = lines.join("; ");
        }
        heads++;
      } else if (this.header.type === H3_FRAME_DATA) {
        for (let k: i32 = start; k < start + length; k++) {
          out.body.push(r.data[k]);
        }
        out.frames = out.frames + 1;
        if (length > out.largest) {
          out.largest = length;
        }
      }
      at = start + length;
    }
    out.whole = at === n;
    return out;
  }

  /** The decoder's bytes `[start, start + length)` as text. */
  text(start: i32, length: i32): string {
    const out: u8[] = [];
    for (let k: i32 = start; k < start + length; k++) {
      out.push(this.dec.bytes[k]);
    }
    return textOf(out);
  }
}

/** A server under `limits` and `config`, connected to a client with ALPN `limits.alpn`; the client's own streams are not open yet. */
export const h3Connect = (limits: H3Limits, config: Http3Config): H3Peer => {
  const conn = new QuicConnection(h3QuicConfig(limits), fixedEntropy());
  const h3 = new Http3Connection(config, conn);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  qcConnect(conn, c, h3Hello(limits));
  const p = new H3Peer(conn, h3, c);
  p.serve();
  qcDrain(conn, c);
  p.absorb();
  return p;
};

/**
 * A client connected to `server`, listening on `port`, across loopback, with
 * ALPN `limits.alpn`: its handshake datagrams go through the server's
 * listener and into a slot. Its own streams are not open yet.
 */
export const h3WireConnect = (server: Http3Server, port: i32, limits: H3Limits): H3Peer => {
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  const p = new H3Peer(server.quic(n32(0)), server.connection(n32(0)), c);
  const wire = new H3Wire(server, port);
  p.wire = wire;
  const hello: u8[] = h3Hello(limits);
  c.before = hello;
  const from: i32 = toI32(c.datagrams.length);
  p.transmit(wire, qcInitial(c, qcCrypto(n64(0), hello), n32(1200)));
  if (qcReadFlight(c, from, n32(0))) {
    p.transmit(wire, qcFinishedPacket(c));
  }
  return p;
};

/** An HTTP/3 connection over a QUIC connection that has not started. */
export const h3Fresh = (): Http3Connection =>
  new Http3Connection(h3Config(), new QuicConnection(h3QuicConfig(new H3Limits()), fixedEntropy()));

/** A connected pair with the client's streams open and SETTINGS sent, on the defaults. */
export const h3Ready = (): H3Peer => {
  const p: H3Peer = h3Connect(new H3Limits(), h3Config());
  p.open(n64(-1));
  p.settle();
  return p;
};

/** Whether the server's application logged `line`. */
export const h3Saw = (p: H3Peer, line: string): boolean => toI32(p.log.indexOf(line)) >= 0;

/** Checks the client got `want` events in the server's log, in order, and says which was missing. */
export const h3Logged = (t: Suite, name: string, p: H3Peer, want: string[]): boolean => {
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

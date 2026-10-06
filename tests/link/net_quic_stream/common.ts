// What the stream and datagram checks start from: a configuration with the
// limits a case needs, a client whose transport parameters say what it lets
// the server do, a connected pair, the server's application loop over
// `nextStreamEvent`, and readers for what the server sent on each stream.
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { QUIC_FRAME_STREAM, QuicFrame, quicParseFrame, quicPushAck, quicPushStream } from "nish/net/quic-frame";
import { QuicTransportParameters, quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QuicConnection, QuicServerConfig } from "nish/net/quic";
import { QUIC_STREAM_END, QUIC_STREAM_ERR_RESET } from "nish/net/quic-stream";
import { leafCertificate } from "../net_tls_common/server";
import { bytesOf, fromHex, textOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { fixedEntropy, resetKey, tokenKey } from "../net_quic_conn_replay/server";
import { CLIENT_SCID, QcClient, qcConnect, qcDrain, qcExchange, qcHello, qcShort } from "../net_quic_conn/client";

/** What a case configures: the server's limits and buffers, and what the client gives the server. */
export class NqLimits {
  maxData: i64 = 65536;
  maxStreamData: i64 = 4096;
  maxStreamsBidi: i64 = 8;
  maxStreamsUni: i64 = 4;
  localStreams: i64 = 4;
  maxDatagramFrameSize: i64 = 0;
  /** The client's transport parameters. */
  clientMaxData: i64 = 1048576;
  clientBidiLocal: i64 = 65536;
  clientBidiRemote: i64 = 65536;
  clientUni: i64 = 65536;
  clientStreamsBidi: i64 = 8;
  clientStreamsUni: i64 = 8;
  clientDatagram: i64 = 0;
}

/** The server configuration `limits` describes, for the echo's ALPN. */
export const nqConfig = (limits: NqLimits): QuicServerConfig => {
  const chain: u8[][] = [leafCertificate()];
  return {
    certificateChain: chain,
    alpn: ["nish-echo"],
    signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
    maxData: limits.maxData,
    maxStreamData: limits.maxStreamData,
    maxStreamsBidi: limits.maxStreamsBidi,
    maxStreamsUni: limits.maxStreamsUni,
    localStreams: limits.localStreams,
    maxDatagramFrameSize: limits.maxDatagramFrameSize,
    maxIdleTimeout: n64(30000),
    activeConnectionIdLimit: n64(4),
    statelessResetKey: resetKey(),
    retryTokenKey: tokenKey(),
    retry: false,
    retryTokenLifetime: n64(10000),
  };
};

/** The client's transport parameters as `limits` gives them. */
export const nqParams = (limits: NqLimits): QuicTransportParameters => {
  const p = new QuicTransportParameters();
  p.initialScid = fromHex(CLIENT_SCID);
  p.hasInitialScid = true;
  p.initialMaxData = limits.clientMaxData;
  p.initialMaxStreamDataBidiLocal = limits.clientBidiLocal;
  p.initialMaxStreamDataBidiRemote = limits.clientBidiRemote;
  p.initialMaxStreamDataUni = limits.clientUni;
  p.initialMaxStreamsBidi = limits.clientStreamsBidi;
  p.initialMaxStreamsUni = limits.clientStreamsUni;
  p.maxDatagramFrameSize = limits.clientDatagram;
  p.activeConnectionIdLimit = n64(4);
  return p;
};

/** A server under `limits` and a client that completed the handshake with it. */
export class NqPair {
  conn: QuicConnection;
  c: QcClient;

  constructor(conn: QuicConnection, c: QcClient) {
    this.conn = conn;
    this.c = c;
  }
}

/** A client that completes a handshake with `conn` under `limits`. */
export const nqConnect = (conn: QuicConnection, limits: NqLimits): QcClient => {
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  qcConnect(conn, c, qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(nqParams(limits))));
  return c;
};

/** A fresh server under `limits`, connected. */
export const nqPair = (limits: NqLimits): NqPair => {
  const conn = new QuicConnection(nqConfig(limits), fixedEntropy());
  return new NqPair(conn, nqConnect(conn, limits));
};

/** `count` bytes of a repeating pattern, `0123456789`, as text. */
export const nqText = (count: i32): string => {
  const parts: string[] = [];
  for (let k: i32 = 0; k < count; k++) {
    parts.push(`${k % 10}`);
  }
  return parts.join("");
};

/** Sends `payload` to the server in a 1-RTT packet and takes what it answers. */
export const nqSend = (p: NqPair, payload: u8[]): void => {
  qcExchange(p.conn, p.c, qcShort(p.c, payload));
};

/** The client acknowledges every 1-RTT packet the server sent so far, and takes what that lets out. */
export const nqAck = (p: NqPair): void => {
  if (p.c.largestApp < 0) {
    return;
  }
  const ack: u8[] = [];
  quicPushAck(ack, [n64(0), p.c.largestApp], n32(1), n64(0));
  nqSend(p, ack);
};

/** Drains, acknowledges and drains again, a few times over, until the server has nothing more. */
export const nqSettle = (p: NqPair): void => {
  for (let k: i32 = 0; k < 8; k++) {
    qcDrain(p.conn, p.c);
    nqAck(p);
  }
};

/**
 * The bytes the server sent on stream `id`, put in order from every 1-RTT
 * payload the client received, as text, with ` <fin>` once the FIN arrived.
 * A frame that repeats bytes already taken adds nothing.
 */
export const nqReceived = (c: QcClient, id: i64): string => {
  const data: u8[] = [];
  let fin: boolean = false;
  const frame = new QuicFrame();
  // Frames can arrive out of order after a loss: go round until nothing more joins.
  for (let pass: i32 = 0; pass < 4; pass++) {
    for (const payload of c.appPayloads) {
      let at: i32 = 0;
      while (at < toI32(payload.length)) {
        if (quicParseFrame(frame, payload, at, toI32(payload.length)) !== n64(0) || frame.end <= at) {
          break;
        }
        if (frame.type === QUIC_FRAME_STREAM && frame.streamId === id && frame.offset <= toI64(toI32(data.length))) {
          const skip: i32 = toI32(toI64(toI32(data.length)) - frame.offset);
          for (let k: i32 = skip; k < frame.dataLength; k++) {
            data.push(payload[frame.dataStart + k]);
          }
          fin = fin || frame.fin;
        }
        at = frame.end;
      }
    }
  }
  return `${textOf(data)}${fin ? " <fin>" : ""}`;
};

/** What the server's application read: each stream's text in the order its first byte came, ` <fin>` after the end. */
export class NqRead {
  ids: i64[];
  texts: string[];
  resets: i64[];

  constructor() {
    this.ids = [];
    this.texts = [];
    this.resets = [];
  }

  /** The text read from stream `id`, or `?` when nothing was. */
  of(id: i64): string {
    for (let k: i32 = 0; k < toI32(this.ids.length); k++) {
      if (this.ids[k] === id) {
        return this.texts[k];
      }
    }
    return "?";
  }

  /** Adds `text` to what stream `id` read. */
  add(id: i64, text: string): void {
    for (let k: i32 = 0; k < toI32(this.ids.length); k++) {
      if (this.ids[k] === id) {
        this.texts[k] = `${this.texts[k]}${text}`;
        return;
      }
    }
    this.ids.push(id);
    this.texts.push(text);
  }
}

/**
 * The server's application: every stream `nextStreamEvent` names is read
 * a chunk of `chunk` bytes at a time until it has nothing more, into `into`;
 * a reset is noted with its code.
 */
export const nqReadAll = (conn: QuicConnection, chunk: i32, into: NqRead): void => {
  const buf: u8[] = new Array<u8>(chunk);
  let id: i64 = conn.nextStreamEvent();
  while (id >= n64(0)) {
    // The reset's code is read before the read that reports it, which may free the stream.
    const stream = conn.streams.find(id);
    const resetCode: i64 = stream !== null ? stream.resetCode : n64(-1);
    let n: i32 = conn.streamRead(id, buf, n32(0), chunk);
    while (n > 0) {
      const part: u8[] = [];
      for (let k: i32 = 0; k < n; k++) {
        part.push(buf[k]);
      }
      into.add(id, textOf(part));
      n = conn.streamRead(id, buf, n32(0), chunk);
    }
    if (n === QUIC_STREAM_END) {
      into.add(id, " <fin>");
    } else if (n === QUIC_STREAM_ERR_RESET) {
      into.resets.push(id);
      into.add(id, ` <reset ${resetCode}>`);
    }
    id = conn.nextStreamEvent();
  }
};

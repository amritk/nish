// What every `net_quic_conn` check starts from: a server configuration with
// the limits a case needs, a fresh connection, a client that has completed
// the handshake with it, and readers for what the server sent back.
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { QuicFrame, quicParseFrame } from "nish/net/quic-frame";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QuicConnection, QuicServerConfig } from "nish/net/quic";
import { leafCertificate } from "../net_tls_common/server";
import { fromHex } from "../crypto_x509/hex";
import { n64 } from "../net_quic_frame/typed";
import { fixedEntropy, resetKey, tokenKey } from "../net_quic_conn_replay/server";
import { CLIENT_SCID, QcClient, qcConnect, qcHello, qcParams } from "./client";

/** A configuration for the echo's ALPN with the given limits. */
export const qcConfig = (maxData: i64, maxStreamData: i64, maxStreams: i64, cidLimit: i64): QuicServerConfig => {
  const chain: u8[][] = [leafCertificate()];
  return {
    certificateChain: chain,
    alpn: ["nish-echo"],
    signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
    maxData: maxData,
    maxStreamData: maxStreamData,
    maxStreamsBidi: maxStreams,
    maxStreamsUni: n64(0),
    localStreams: n64(0),
    maxDatagramFrameSize: n64(0),
    maxIdleTimeout: n64(30000),
    activeConnectionIdLimit: cidLimit,
    statelessResetKey: resetKey(),
    retryTokenKey: tokenKey(),
    retry: false,
    retryTokenLifetime: n64(10000),
  };
};

/** The configuration most cases use: 64 KiB for the connection, 16 KiB a stream, four streams, four IDs. */
export const qcDefaultConfig = (): QuicServerConfig => qcConfig(n64(65536), n64(16384), n64(4), n64(4));

/** A fresh connection under `config`. */
export const qcServer = (config: QuicServerConfig): QuicConnection => new QuicConnection(config, fixedEntropy());

/** A client that completed a handshake under AES-128-GCM, with `bidiLocal` of credit for the server. */
export const qcConnected = (conn: QuicConnection, bidiLocal: i64): QcClient => {
  const scid: u8[] = fromHex(CLIENT_SCID);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  qcConnect(conn, c, qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(scid, bidiLocal))));
  return c;
};

/** The frame types of a payload, in order, as `2 30 24` (PADDING runs included, as one 0 each). */
export const qcFrameTypes = (payload: u8[]): string => {
  const types: string[] = [];
  const frame = new QuicFrame();
  let at: i32 = 0;
  while (at < toI32(payload.length)) {
    if (quicParseFrame(frame, payload, at, toI32(payload.length)) !== n64(0) || frame.end <= at) {
      types.push("?");
      return types.join(" ");
    }
    types.push(`${frame.type}`);
    at = frame.end;
  }
  return types.join(" ");
};

/** The first frame of `type` in any of `payloads`, read into a fresh frame, with `found` set; its data is in `foundPayload`. */
export class QcFound {
  frame: QuicFrame;
  payload: u8[];
  found: boolean = false;

  constructor() {
    this.frame = new QuicFrame();
    this.payload = [];
  }
}

/** Looks for the first frame of `type` in `payloads`. */
export const qcFind = (payloads: u8[][], type: i32): QcFound => {
  const out = new QcFound();
  for (const payload of payloads) {
    let at: i32 = 0;
    while (at < toI32(payload.length)) {
      if (quicParseFrame(out.frame, payload, at, toI32(payload.length)) !== n64(0) || out.frame.end <= at) {
        break;
      }
      if (out.frame.type === type) {
        out.found = true;
        out.payload = payload;
        return out;
      }
      at = out.frame.end;
    }
  }
  return out;
};

/** The connection ID a found NEW_CONNECTION_ID frame carries, copied out of its payload. */
export const qcFoundCid = (f: QcFound): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = f.frame.connectionIdStart; k < f.frame.connectionIdStart + f.frame.connectionIdLength && k < toI32(f.payload.length); k++) {
    if (k >= 0) {
      out.push(f.payload[k]);
    }
  }
  return out;
};

/** The bytes of a found frame's data window. */
export const qcData = (f: QcFound): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = f.frame.dataStart; k < f.frame.dataStart + f.frame.dataLength && k < toI32(f.payload.length); k++) {
    if (k >= 0) {
      out.push(f.payload[k]);
    }
  }
  return out;
};


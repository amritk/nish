// What the `net_quic_lifecycle` checks share: the listener's fixed entropy,
// a client address, datagrams built by hand for the cases no real client
// sends, and readers for what the server answered.
import { QUIC_FRAME_CONNECTION_CLOSE, QUIC_FRAME_NEW_CONNECTION_ID, QuicFrame, quicParseFrame } from "nish/net/quic-frame";
import {
  QUIC_LISTEN_ACCEPT,
  QUIC_LISTEN_DROP,
  QUIC_LISTEN_INVALID_TOKEN,
  QUIC_LISTEN_RETRY,
  QUIC_LISTEN_STATELESS_RESET,
  QUIC_LISTEN_VERSION_NEGOTIATION,
  QUIC_LISTENER_ENTROPY_SIZE,
} from "nish/net/quic-listener";
import { QuicServerConfig } from "nish/net/quic";
import { fromHex } from "../crypto_x509/hex";
import { n64 } from "../net_quic_frame/typed";
import { QcFound, qcDefaultConfig, qcFind } from "../net_quic_conn/common";
import { bytesFrom } from "../net_tls_common/client";

/** The entropy every listener in these checks and in the recordings is made with: 0x60, 0x61, … */
export const lcListenerEntropy = (): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < QUIC_LISTENER_ENTROPY_SIZE; k++) {
    out.push(toU8(0x60 + k));
  }
  return out;
};

/** A client address as a socket reports it: IPv4 127.0.0.1, port 54321. */
export const lcClientAddress = (): u8[] => fromHex("0200d4317f000001000000000000000000000000");

/** Another client's address: the same host, port 54322. */
export const lcOtherAddress = (): u8[] => fromHex("0200d4327f000001000000000000000000000000");

/** The default configuration, with or without Retry. */
export const lcConfig = (retry: boolean): QuicServerConfig => {
  const config: QuicServerConfig = qcDefaultConfig();
  config.retry = retry;
  return config;
};

/** A `QUIC_LISTEN_*` by name, so a check reads as prose. */
export const lcKindName = (kind: i32): string => {
  if (kind === QUIC_LISTEN_DROP) {
    return "drop";
  }
  if (kind === QUIC_LISTEN_ACCEPT) {
    return "accept";
  }
  if (kind === QUIC_LISTEN_VERSION_NEGOTIATION) {
    return "version negotiation";
  }
  if (kind === QUIC_LISTEN_RETRY) {
    return "retry";
  }
  if (kind === QUIC_LISTEN_INVALID_TOKEN) {
    return "invalid token";
  }
  return kind === QUIC_LISTEN_STATELESS_RESET ? "stateless reset" : "?";
};

/**
 * A long-header datagram of `size` bytes in `version` (eight hex digits),
 * from `scid` to `dcid`: what a client of another version sends first, as
 * far as RFC 8999's invariants go, then zeros.
 */
export const lcOtherVersion = (version: string, dcid: u8[], scid: u8[], size: i32): u8[] => {
  const out: u8[] = [toU8(0xc3)];
  for (const b of fromHex(version)) {
    out.push(b);
  }
  out.push(toU8(toI32(dcid.length)));
  for (const b of dcid) {
    out.push(b);
  }
  out.push(toU8(toI32(scid.length)));
  for (const b of scid) {
    out.push(b);
  }
  while (toI32(out.length) < size) {
    out.push(toU8(0));
  }
  return out;
};

/** A short-header datagram of `size` bytes to `dcid`, the rest zeros: a packet for a connection the server may not have. */
export const lcShortTo = (dcid: u8[], size: i32): u8[] => {
  const out: u8[] = [toU8(0x41)];
  for (const b of dcid) {
    out.push(b);
  }
  while (toI32(out.length) < size) {
    out.push(toU8(0x5a));
  }
  return out;
};

/** The last `n` bytes of `bytes`. */
export const lcTail = (bytes: u8[], n: i32): u8[] => bytesFrom(bytes, toI32(bytes.length) - n);

/** Whether every byte of `bytes` is zero: a wipe happened. */
export const lcAllZero = (bytes: u8[]): boolean => {
  let zero: boolean = true;
  for (const b of bytes) {
    zero = zero && toI32(b) === 0;
  }
  return zero;
};

/** One NEW_CONNECTION_ID the server sent: the ID and its reset token. */
export class LcIssuedId {
  cid: u8[];
  token: u8[];

  constructor(cid: u8[], token: u8[]) {
    this.cid = cid;
    this.token = token;
  }
}

/** Every NEW_CONNECTION_ID frame in `payloads`, in order. */
export const lcIssuedIds = (payloads: u8[][]): LcIssuedId[] => {
  const out: LcIssuedId[] = [];
  const frame = new QuicFrame();
  for (const payload of payloads) {
    let at: i32 = 0;
    while (at < toI32(payload.length)) {
      if (quicParseFrame(frame, payload, at, toI32(payload.length)) !== n64(0) || frame.end <= at) {
        break;
      }
      if (frame.type === QUIC_FRAME_NEW_CONNECTION_ID) {
        const cid: u8[] = [];
        const token: u8[] = [];
        for (let k: i32 = 0; k < frame.connectionIdLength; k++) {
          cid.push(payload[frame.connectionIdStart + k]);
        }
        for (let k: i32 = 0; k < 16; k++) {
          token.push(payload[frame.resetTokenStart + k]);
        }
        out.push(new LcIssuedId(cid, token));
      }
      at = frame.end;
    }
  }
  return out;
};

/** The error code and frame type of the first CONNECTION_CLOSE in `payloads`, as `code type`, or "no close". */
export const lcCloseIn = (payloads: u8[][]): string => {
  const f: QcFound = qcFind(payloads, QUIC_FRAME_CONNECTION_CLOSE);
  return f.found ? `${f.frame.errorCode} ${f.frame.frameType}` : "no close";
};

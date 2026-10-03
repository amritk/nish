// The client half the `nish/net/quic` tests play, sans-IO: a QUIC client
// built from the pieces the tests already trust rather than from the server's
// code paths. Its ClientHello and its side of the TLS key exchange are
// `tests/link/net_tls_common/client`'s (whose every step is pinned against RFC
// 8448), its packets are sealed and opened with `nish/net/quic-packet` (pinned
// against RFC 9001 Appendix A), and its frames are written byte by byte or
// with `nish/net/quic-frame`'s writers (pinned in `net_quic_frame`). So a
// handshake that completes here is the server agreeing with three independent
// references at once.
import { Secret, secret, wipe } from "nish:secret";
import {
  QUIC_AEAD_AES_128_GCM,
  QUIC_AEAD_AES_256_GCM,
  QUIC_AEAD_CHACHA20_POLY1305,
  QUIC_PACKET_HANDSHAKE,
  QUIC_PACKET_INITIAL,
  QUIC_PACKET_OK,
  QUIC_PACKET_SHORT,
  QuicHeader,
  QuicInitialSecrets,
  QuicKeys,
  QuicPacket,
  quicInitialSecrets,
  quicKeys,
  quicLongHeader,
  quicOpenPacket,
  quicParseHeader,
  quicSealPacket,
  quicShortHeader,
} from "nish/net/quic-packet";
import { QUIC_FRAME_CRYPTO, QuicFrame, quicParseFrame, quicPushCrypto, quicPushPadding } from "nish/net/quic-frame";
import { QuicTransportParameters } from "nish/net/quic-conn-params";
import { QuicConnection } from "nish/net/quic";
import { tlsSignEcdsaP256 } from "nish/net/tls";
import { TLS_GROUP_X25519, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec";
import {
  TLS_AES_256_GCM_SHA384,
  TLS_CHACHA20_POLY1305_SHA256,
  tlsDeriveSecret,
  tlsEarlySecret,
  tlsHandshakeSecret,
  tlsMasterSecret,
  tlsSuiteHashLength,
} from "nish/net/tls/schedule";
import {
  ClientView,
  cat,
  clientFinish,
  clientHello,
  clientPrivate,
  extAlpn,
  extKeyShare,
  extQuic,
  extSignatureAlgorithms,
  extSupportedGroups,
  extSupportedVersions,
  serverShareOf,
  standardWith,
  transcriptHash,
} from "../net_tls_common/client";
import { x25519Plain } from "../crypto_x25519/plain";
import { leafPrivate, leafPublic } from "../net_tls_common/server";
import { fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";

/** The DCID every test client's first Initial is sent to. */
export const CLIENT_ODCID: string = "0001020304050607";
/** The SCID every test client uses unless a case says otherwise. */
export const CLIENT_SCID: string = "c0c1c2c3c4c5c6c7";

/** One test client's state: its keys per level, its packet numbers, and what the server sent it. */
export class QcClient {
  suite: i32 = 0;
  hashLength: i32 = 0;
  initialPn: i64 = 0;
  handshakePn: i64 = 0;
  appPn: i64 = 0;
  largestInitial: i64 = -1;
  largestHandshake: i64 = -1;
  largestApp: i64 = -1;
  odcid: u8[];
  scid: u8[];
  /** The server's SCID, learned from its first long header. */
  serverScid: u8[];
  initialWrite: QuicKeys | null = null;
  initialRead: QuicKeys | null = null;
  handshakeWrite: QuicKeys | null = null;
  handshakeRead: QuicKeys | null = null;
  appWrite: QuicKeys | null = null;
  appRead: QuicKeys | null = null;
  /** Every message of the transcript before the ServerHello, as `clientFinish` takes it. */
  before: u8[];
  /** The server's CRYPTO bytes at the Initial and the Handshake level, in order. */
  cryptoInitial: u8[];
  cryptoHandshake: u8[];
  /** The plaintext payload of every 1-RTT packet the server sent, in order. */
  appPayloads: u8[][];
  /** The plaintext payload of every Initial and Handshake packet, in order. */
  longPayloads: u8[][];
  /** Every datagram the server sent, as sent. */
  datagrams: u8[][];
  view: ClientView;

  constructor(suite: i32, scid: u8[]) {
    this.suite = suite;
    this.hashLength = tlsSuiteHashLength(suite);
    this.odcid = fromHex(CLIENT_ODCID);
    this.scid = scid;
    this.serverScid = [];
    this.before = [];
    this.cryptoInitial = [];
    this.cryptoHandshake = [];
    this.appPayloads = [];
    this.longPayloads = [];
    this.datagrams = [];
    this.view = new ClientView();
    const secrets: QuicInitialSecrets | null = quicInitialSecrets(this.odcid);
    if (secrets !== null) {
      this.initialWrite = quicKeys(QUIC_AEAD_AES_128_GCM, secrets.client);
      this.initialRead = quicKeys(QUIC_AEAD_AES_128_GCM, secrets.server);
    }
  }
}

/** The AEAD a suite protects packets with. */
export const qcAead = (suite: i32): i32 => {
  if (suite === TLS_AES_256_GCM_SHA384) {
    return QUIC_AEAD_AES_256_GCM;
  }
  return suite === TLS_CHACHA20_POLY1305_SHA256 ? QUIC_AEAD_CHACHA20_POLY1305 : QUIC_AEAD_AES_128_GCM;
};

/** The client's transport parameters: `scid` as its initial SCID, `bidiLocal` of credit for the server on its streams. */
export const qcParams = (scid: u8[], bidiLocal: i64): QuicTransportParameters => {
  const p = new QuicTransportParameters();
  p.initialScid = scid;
  p.hasInitialScid = true;
  p.initialMaxData = n64(1048576);
  p.initialMaxStreamDataBidiLocal = bidiLocal;
  p.initialMaxStreamsBidi = n64(8);
  p.activeConnectionIdLimit = n64(4);
  return p;
};

/** A ClientHello offering `suites`, ALPN `alpn` (none when empty) and the transport parameters `params`. */
export const qcHello = (suites: i32[], alpn: string, params: u8[]): u8[] => {
  const more: u8[][] = [extQuic(params)];
  if (toI32(alpn.length) > 0) {
    more.push(extAlpn([alpn]));
  }
  return clientHello(suites, standardWith(more));
};

/** A ClientHello that offers x25519 without a share, which the server answers with a HelloRetryRequest. */
export const qcHelloWithoutShare = (suites: i32[], params: u8[]): u8[] => {
  const none: u8[][] = [];
  const noKeys: i32[] = [];
  return clientHello(suites, [
    extSupportedVersions([TLS_VERSION_13]),
    extSupportedGroups([TLS_GROUP_X25519]),
    extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
    extKeyShare(noKeys, none),
    extAlpn(["nish-echo"]),
    extQuic(params),
  ]);
};

/** A CRYPTO frame carrying all of `data` at `offset`. */
export const qcCrypto = (offset: i64, data: u8[]): u8[] => {
  const out: u8[] = [];
  quicPushCrypto(out, offset, data, n32(0), toI32(data.length));
  return out;
};

/** Seals `payload` under `keys` behind `header`, or an empty array when that fails. */
const qcSeal = (keys: QuicKeys | null, header: u8[] | null, pn: i64, payload: u8[]): u8[] => {
  const none: u8[] = [];
  if (keys === null || header === null) {
    return none;
  }
  const packet: u8[] | null = quicSealPacket(keys, header, pn, payload);
  return packet === null ? none : packet;
};

/** The DCID the client's long headers go to: the server's SCID once known, the original DCID before. */
const qcLongDcid = (c: QcClient): u8[] => (toI32(c.serverScid.length) > 0 ? c.serverScid : c.odcid);

/**
 * An Initial packet of `payload`, padded with PADDING so that it alone makes
 * a datagram of `padTo` bytes (0 for no padding).
 */
export const qcInitial = (c: QcClient, payload: u8[], padTo: i32): u8[] => {
  const none: u8[] = [];
  const pnLength: i32 = 4;
  // The header's size does not move with the payload's: Length is always two bytes.
  const probe: u8[] | null = quicLongHeader(QUIC_PACKET_INITIAL, qcLongDcid(c), c.scid, none, c.initialPn, pnLength, n32(0));
  const headerLength: i32 = probe === null ? 0 : toI32(probe.length);
  const body: u8[] = cat([payload]);
  const pad: i32 = padTo - headerLength - toI32(body.length) - 16;
  if (pad > 0) {
    quicPushPadding(body, pad);
  }
  const header: u8[] | null = quicLongHeader(QUIC_PACKET_INITIAL, qcLongDcid(c), c.scid, none, c.initialPn, pnLength, toI32(body.length));
  const packet: u8[] = qcSeal(c.initialWrite, header, c.initialPn, body);
  c.initialPn = c.initialPn + 1;
  return packet;
};

/** A Handshake packet of `payload`. */
export const qcHandshake = (c: QcClient, payload: u8[]): u8[] => {
  const none: u8[] = [];
  const header: u8[] | null = quicLongHeader(QUIC_PACKET_HANDSHAKE, qcLongDcid(c), c.scid, none, c.handshakePn, n32(4), toI32(payload.length));
  const packet: u8[] = qcSeal(c.handshakeWrite, header, c.handshakePn, payload);
  c.handshakePn = c.handshakePn + 1;
  return packet;
};

/** A 1-RTT packet of `payload` to the server's ID `dcid`, with `firstBits` ORed into the first byte before sealing. */
export const qcShortTo = (c: QcClient, dcid: u8[], payload: u8[], firstBits: i32): u8[] => {
  const header: u8[] | null = quicShortHeader(dcid, false, false, c.appPn, n32(4));
  if (header !== null && toI32(header.length) > 0) {
    header[0] = toU8(toI32(header[0]) | firstBits);
  }
  const packet: u8[] = qcSeal(c.appWrite, header, c.appPn, payload);
  c.appPn = c.appPn + 1;
  return packet;
};

/** A 1-RTT packet of `payload` to the server's first ID. */
export const qcShort = (c: QcClient, payload: u8[]): u8[] => qcShortTo(c, c.serverScid, payload, n32(0));

/** Appends the CRYPTO frames of a payload to the level's stream; the server sends them in order. */
const qcTakeCrypto = (stream: u8[], payload: u8[]): void => {
  const frame = new QuicFrame();
  let at: i32 = 0;
  while (at < toI32(payload.length)) {
    if (quicParseFrame(frame, payload, at, toI32(payload.length)) !== n64(0) || frame.end <= at) {
      return;
    }
    if (frame.type === QUIC_FRAME_CRYPTO && frame.offset === toI64(toI32(stream.length))) {
      for (let k: i32 = frame.dataStart; k < frame.dataStart + frame.dataLength && k < toI32(payload.length); k++) {
        if (k >= 0) {
          stream.push(payload[k]);
        }
      }
    }
    at = frame.end;
  }
};

/**
 * Opens every packet of a datagram the server sent, with the keys the client
 * holds for its type, and files what it carried. Answers how many opened.
 */
export const qcReceive = (c: QcClient, datagram: u8[]): i32 => {
  let opened: i32 = 0;
  let at: i32 = 0;
  while (at < toI32(datagram.length)) {
    const header: QuicHeader = quicParseHeader(datagram, at, toI32(c.scid.length));
    if (header.error !== QUIC_PACKET_OK) {
      return opened;
    }
    if (header.type !== QUIC_PACKET_SHORT && toI32(c.serverScid.length) === 0) {
      c.serverScid = header.scid;
    }
    let keys: QuicKeys | null = c.appRead;
    let largest: i64 = c.largestApp;
    if (header.type === QUIC_PACKET_INITIAL) {
      keys = c.initialRead;
      largest = c.largestInitial;
    } else if (header.type === QUIC_PACKET_HANDSHAKE) {
      keys = c.handshakeRead;
      largest = c.largestHandshake;
    }
    if (keys !== null) {
      const packet: QuicPacket = quicOpenPacket(keys, datagram, header, largest);
      if (packet.error === QUIC_PACKET_OK) {
        opened++;
        if (header.type === QUIC_PACKET_INITIAL) {
          c.largestInitial = packet.packetNumber;
          c.longPayloads.push(packet.payload);
          qcTakeCrypto(c.cryptoInitial, packet.payload);
        } else if (header.type === QUIC_PACKET_HANDSHAKE) {
          c.largestHandshake = packet.packetNumber;
          c.longPayloads.push(packet.payload);
          qcTakeCrypto(c.cryptoHandshake, packet.payload);
        } else {
          c.largestApp = packet.packetNumber;
          c.appPayloads.push(packet.payload);
        }
      }
    }
    if (header.type === QUIC_PACKET_SHORT || header.end <= at) {
      return opened;
    }
    at = header.end;
  }
  return opened;
};

/**
 * Hands `datagram` to the server as its client would, signs when asked, and
 * opens every datagram the server answers. Answers how many it answered.
 */
export const qcExchange = (conn: QuicConnection, c: QcClient, datagram: u8[]): i32 => {
  conn.receive(datagram);
  const input: u8[] | null = conn.signatureInput();
  if (input !== null) {
    const key: Secret<u8[]> = secret(leafPrivate());
    const signature: u8[] | null = tlsSignEcdsaP256(key, input);
    wipe(key);
    if (signature !== null) {
      conn.sign(signature);
    }
  }
  return qcDrain(conn, c);
};

/** Takes every datagram the server has to send and opens it. Answers how many there were. */
export const qcDrain = (conn: QuicConnection, c: QcClient): i32 => {
  let n: i32 = 0;
  let out: u8[] | null = conn.takeDatagram();
  while (out !== null) {
    c.datagrams.push(out);
    qcReceive(c, out);
    n++;
    out = conn.takeDatagram();
  }
  return n;
};

/**
 * Once the ServerHello is in: the handshake keys, from the client's own
 * x25519 exchange and the transcript `before` plus the ServerHello.
 */
export const qcHandshakeKeys = (c: QcClient, serverHello: u8[]): void => {
  const none: u8[] = [];
  c.view = clientFinish(c.hashLength, c.before, serverHello, none, none);
  c.handshakeWrite = quicKeys(qcAead(c.suite), c.view.clientHandshakeSecret);
  c.handshakeRead = quicKeys(qcAead(c.suite), c.view.serverHandshakeSecret);
};

/**
 * Once the server's flight is in: the client's view of it (its signature and
 * Finished checked), the client Finished, and the 1-RTT keys from the
 * master secret over the transcript through the server's Finished.
 */
export const qcFinish = (c: QcClient, serverHello: u8[]): void => {
  const h: i32 = c.hashLength;
  c.view = clientFinish(h, c.before, serverHello, c.cryptoHandshake, leafPublic());
  const shared: u8[] | null = x25519Plain(clientPrivate(), serverShareOf(serverHello));
  const none: u8[] = [];
  const handshakeSecret: u8[] = tlsHandshakeSecret(h, tlsEarlySecret(h), shared === null ? none : shared);
  const master: u8[] = tlsMasterSecret(h, handshakeSecret);
  const th: u8[] = transcriptHash(h, cat([c.before, serverHello, c.cryptoHandshake]));
  c.appWrite = quicKeys(qcAead(c.suite), tlsDeriveSecret(h, master, "c ap traffic", th));
  c.appRead = quicKeys(qcAead(c.suite), tlsDeriveSecret(h, master, "s ap traffic", th));
};

/** The client's Finished in a Handshake packet. */
export const qcFinishedPacket = (c: QcClient): u8[] => qcHandshake(c, qcCrypto(n64(0), c.view.clientFinished));

/**
 * Sends `hello` in a padded Initial at CRYPTO offset `offset` (0, or past a
 * first ClientHello after a HelloRetryRequest) and reads what the server
 * answers. `before` is the transcript `clientFinish` will hash before the
 * ServerHello. Answers the index in `c.datagrams` the answer starts at.
 */
export const qcSendHello = (conn: QuicConnection, c: QcClient, hello: u8[], offset: i64, before: u8[]): i32 => {
  c.before = before;
  const from: i32 = toI32(c.datagrams.length);
  qcExchange(conn, c, qcInitial(c, qcCrypto(offset, hello), n32(1200)));
  return from;
};

/**
 * Reads the server's flight from `c.datagrams[from ..]`: the ServerHello at
 * `c.cryptoInitial[helloAt ..]`, the handshake keys from it, the Handshake
 * packets opened again now that they can be, and the 1-RTT keys. Answers
 * whether the client accepts the flight.
 */
export const qcReadFlight = (c: QcClient, from: i32, helloAt: i32): boolean => {
  const serverHello: u8[] = [];
  for (let k: i32 = helloAt; k < toI32(c.cryptoInitial.length); k++) {
    if (k >= 0) {
      serverHello.push(c.cryptoInitial[k]);
    }
  }
  if (toI32(serverHello.length) === 0) {
    return false;
  }
  qcHandshakeKeys(c, serverHello);
  // The Handshake packets came before the keys to open them existed: open
  // the flight again. Its Initial CRYPTO is already in, and is not taken twice.
  c.longPayloads = [];
  for (let k: i32 = from; k < toI32(c.datagrams.length); k++) {
    if (k >= 0) {
      qcReceive(c, c.datagrams[k]);
    }
  }
  qcFinish(c, serverHello);
  return c.view.signatureVerifies && c.view.serverFinishedVerifies;
};

/**
 * A whole handshake: the ClientHello `hello` (already carrying the client's
 * transport parameters) in a padded Initial, the server's flight read and
 * checked, and the client Finished sent. Answers whether the server reached
 * the connected state.
 */
export const qcConnect = (conn: QuicConnection, c: QcClient, hello: u8[]): boolean => {
  const from: i32 = qcSendHello(conn, c, hello, n64(0), hello);
  if (!qcReadFlight(c, from, n32(0))) {
    return false;
  }
  qcExchange(conn, c, qcFinishedPacket(c));
  return conn.handshakeComplete;
};

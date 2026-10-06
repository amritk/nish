// QUIC-3: nothing allocated per packet, and a connection that is a reusable
// slot. Every call the server makes is measured on its own with
// `Arena.used()` — the client beside it allocates freely, between the
// measurements — and the sum is what the server kept. Over hundreds of
// packets of stream data, acknowledgements and flow-control updates, after a
// warm-up, it keeps nothing; over connection after connection through one
// slot `reset` for each, the reset keeps nothing and neither does anything
// a connection does after its handshake.
import { Secret, secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";
import { quicPushAck } from "nish/net/quic-frame";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QUIC_CONN_DATAGRAM_SIZE, QUIC_STATE_CONNECTED, QuicConnection } from "nish/net/quic";
import { tlsSignEcdsaP256 } from "nish/net/tls";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { cat } from "../net_tls_common/client";
import { leafPrivate } from "../net_tls_common/server";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import {
  CLIENT_SCID,
  QcClient,
  qcCrypto,
  qcFinishedPacket,
  qcHello,
  qcInitial,
  qcReadFlight,
  qcReceive,
  qcShort,
} from "../net_quic_conn/client";
import { NqLimits, nqConfig, nqParams, nqStream, nqText } from "./common";

/** The bytes the server kept across the calls measured so far. */
export class NqMeter {
  kept: i64 = 0;
  out: u8[];
  buf: u8[];

  constructor() {
    this.out = new Array<u8>(QUIC_CONN_DATAGRAM_SIZE);
    this.buf = new Array<u8>(256);
  }
}

/** The server takes `datagram` at `now`, measured. */
export const nqMeteredReceive = (conn: QuicConnection, datagram: u8[], now: i64, m: NqMeter): void => {
  const before: i64 = Arena.used();
  conn.receive(datagram, now);
  m.kept = m.kept + (Arena.used() - before);
};

/**
 * The server writes what it has to send into the meter's buffer, each call
 * measured; the client reads each datagram, unmeasured. Answers how many.
 */
export const nqMeteredDrain = (conn: QuicConnection, c: QcClient, m: NqMeter): i32 => {
  let count: i32 = 0;
  for (let guard: i32 = 0; guard < 64; guard++) {
    const before: i64 = Arena.used();
    const n: i32 = conn.takeDatagramInto(m.out, n32(0), c.now);
    m.kept = m.kept + (Arena.used() - before);
    if (n <= 0) {
      return count;
    }
    const copy: u8[] = [];
    for (let k: i32 = 0; k < n; k++) {
      copy.push(m.out[k]);
    }
    c.datagrams.push(copy);
    qcReceive(c, copy);
    count++;
  }
  return count;
};

/** One round of an echo: the client sends 100 bytes on stream 0 and acknowledges; the server reads and echoes them. */
const echoRound = (conn: QuicConnection, c: QcClient, offset: i64, m: NqMeter): void => {
  const ack: u8[] = [];
  if (c.largestApp >= n64(0)) {
    quicPushAck(ack, [n64(0), c.largestApp], n32(1), n64(0));
  }
  const packet: u8[] = qcShort(c, cat([nqStream(n64(0), offset, nqText(n32(100)), false), ack]));
  nqMeteredReceive(conn, packet, c.now, m);
  const before: i64 = Arena.used();
  let id: i64 = conn.nextStreamEvent();
  while (id >= n64(0)) {
    const n: i32 = conn.streamRead(id, m.buf, n32(0), n32(256));
    if (n > 0) {
      conn.streamWrite(id, m.buf, n32(0), n, false);
    }
    id = conn.nextStreamEvent();
  }
  m.kept = m.kept + (Arena.used() - before);
  nqMeteredDrain(conn, c, m);
};

/** The handshake of `c` with `conn`, every server call measured. Answers whether it completed. */
const meteredHandshake = (conn: QuicConnection, c: QcClient, limits: NqLimits, m: NqMeter): boolean => {
  const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(nqParams(limits)));
  c.before = hello;
  const from: i32 = toI32(c.datagrams.length);
  nqMeteredReceive(conn, qcInitial(c, qcCrypto(n64(0), hello), n32(1200)), c.now, m);
  let before: i64 = Arena.used();
  const input: u8[] | null = conn.signatureInput();
  m.kept = m.kept + (Arena.used() - before);
  if (input !== null) {
    const key: Secret<u8[]> = secret(leafPrivate());
    const signature: u8[] | null = tlsSignEcdsaP256(key, input);
    wipe(key);
    if (signature !== null) {
      before = Arena.used();
      conn.sign(signature);
      m.kept = m.kept + (Arena.used() - before);
    }
  }
  nqMeteredDrain(conn, c, m);
  if (!qcReadFlight(c, from, n32(0))) {
    return false;
  }
  nqMeteredReceive(conn, qcFinishedPacket(c), c.now, m);
  nqMeteredDrain(conn, c, m);
  return conn.state === QUIC_STATE_CONNECTED;
};

/** Hundreds of packets on one connection keep nothing once it is warm. */
const perPacket = (t: Suite): void => {
  const limits = new NqLimits();
  const conn = new QuicConnection(nqConfig(limits), fixedEntropy());
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  const warm = new NqMeter();
  if (!t.ok("connected", meteredHandshake(conn, c, limits, warm))) {
    return;
  }
  for (let k: i32 = 0; k < 20; k++) {
    echoRound(conn, c, toI64(k) * n64(100), warm);
  }
  const m = new NqMeter();
  for (let k: i32 = 20; k < 320; k++) {
    echoRound(conn, c, toI64(k) * n64(100), m);
  }
  t.eqI64("300 packets in and their echoes out, with ACKs and credit updates, keep no arena memory", m.kept, n64(0));
  const zero = conn.streams.find(n64(0));
  t.ok("and the echo is all there: 32,000 bytes sent back", zero !== null && zero.sendNext === n64(32000));
};

/**
 * Connection after connection through one slot: `reset` keeps nothing, and
 * after its handshake a connection keeps nothing either. The handshake
 * itself allocates (TLS-3 and the key derivations, which
 * `docs/security/quic.md` measures), and is not measured here: `Arena.used()`
 * counts the current chunk, and a handshake of some 23 KB crosses chunks.
 */
const perConnection = (t: Suite): void => {
  const limits = new NqLimits();
  const slot = new QuicConnection(nqConfig(limits), fixedEntropy());
  let resets: i64 = 0;
  let after: i64 = 0;
  let connected: i32 = 0;
  for (let k: i32 = 0; k < 6; k++) {
    if (k > 0) {
      const entropy: u8[] = fixedEntropy();
      const before: i64 = Arena.used();
      slot.reset(entropy);
      resets = resets + (Arena.used() - before);
    }
    const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
    if (meteredHandshake(slot, c, limits, new NqMeter())) {
      connected++;
    }
    const rest = new NqMeter();
    for (let r: i32 = 0; r < 10; r++) {
      echoRound(slot, c, toI64(r) * n64(100), rest);
    }
    const before: i64 = Arena.used();
    slot.close(n64(0));
    rest.kept = rest.kept + (Arena.used() - before);
    nqMeteredDrain(slot, c, rest);
    if (k > 0) {
      after = after + rest.kept;
    }
  }
  t.eqI32("six connections, one after another, through one slot", connected, n32(6));
  t.eqI64("resetting the slot for the next keeps no arena memory", resets, n64(0));
  t.eqI64("and after its handshake a connection keeps none: ten echoes, a close", after, n64(0));
};

/** Every arena check. */
export const arenaChecks = (t: Suite): void => {
  perPacket(t);
  perConnection(t);
};

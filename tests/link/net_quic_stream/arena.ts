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

/**
 * The bytes the server kept across the calls measured so far. `Arena.used()`
 * counts the current chunk, so a call that allocates across a chunk's end
 * cannot be measured by a difference. A `fresh` meter starts each call in a
 * chunk of its own instead — a 70,000-byte array, which takes a chunk to
 * itself, fills it, so the call's first allocation starts a new chunk at 0
 * — and counts what the new chunk holds after the call; that is exact for a
 * call that keeps under 64 KiB.
 */
export class NqMeter {
  kept: i64 = 0;
  out: u8[];
  buf: u8[];
  none: u8[];
  fresh: boolean = false;

  constructor(fresh: boolean) {
    this.out = new Array<u8>(QUIC_CONN_DATAGRAM_SIZE);
    this.buf = new Array<u8>(256);
    this.none = [];
    this.fresh = fresh;
  }

  /** A filler that starts the next call in a new chunk, for a `fresh` meter; nothing otherwise. */
  filler(): u8[] {
    return this.fresh ? new Array<u8>(70000) : this.none;
  }

  /** Counts what the call since `before` kept; `filler` is the one taken before it, kept alive until here. */
  add(before: i64, filler: u8[]): void {
    const after: i64 = Arena.used();
    if (!this.fresh) {
      this.kept = this.kept + (after - before);
    } else if (after !== before && toI32(filler.length) > 0) {
      this.kept = this.kept + after;
    }
  }
}

/** The server takes `datagram` at `now`, measured. */
export const nqMeteredReceive = (conn: QuicConnection, datagram: u8[], now: i64, m: NqMeter): void => {
  const filler: u8[] = m.filler();
  const before: i64 = Arena.used();
  conn.receive(datagram, now);
  m.add(before, filler);
};

/**
 * The server writes what it has to send into the meter's buffer, each call
 * measured; the client reads each datagram, unmeasured. Answers how many.
 */
export const nqMeteredDrain = (conn: QuicConnection, c: QcClient, m: NqMeter): i32 => {
  let count: i32 = 0;
  for (let guard: i32 = 0; guard < 64; guard++) {
    const filler: u8[] = m.filler();
    const before: i64 = Arena.used();
    const n: i32 = conn.takeDatagramInto(m.out, n32(0), c.now);
    m.add(before, filler);
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
  const filler: u8[] = m.filler();
  const before: i64 = Arena.used();
  let id: i64 = conn.nextStreamEvent();
  while (id >= n64(0)) {
    const n: i32 = conn.streamRead(id, m.buf, n32(0), n32(256));
    if (n > 0) {
      conn.streamWrite(id, m.buf, n32(0), n, false);
    }
    id = conn.nextStreamEvent();
  }
  m.add(before, filler);
  nqMeteredDrain(conn, c, m);
};

/** The handshake of `c` with `conn`, every server call measured. Answers whether it completed. */
const meteredHandshake = (conn: QuicConnection, c: QcClient, limits: NqLimits, m: NqMeter): boolean => {
  const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(nqParams(limits)));
  c.before = hello;
  const from: i32 = toI32(c.datagrams.length);
  nqMeteredReceive(conn, qcInitial(c, qcCrypto(n64(0), hello), n32(1200)), c.now, m);
  const fillInput: u8[] = m.filler();
  const beforeInput: i64 = Arena.used();
  const input: u8[] | null = conn.signatureInput();
  m.add(beforeInput, fillInput);
  if (input !== null) {
    const key: Secret<u8[]> = secret(leafPrivate());
    const signature: u8[] | null = tlsSignEcdsaP256(key, input);
    wipe(key);
    if (signature !== null) {
      const fillSign: u8[] = m.filler();
      const beforeSign: i64 = Arena.used();
      conn.sign(signature);
      m.add(beforeSign, fillSign);
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
  const warm = new NqMeter(false);
  if (!t.ok("connected", meteredHandshake(conn, c, limits, warm))) {
    return;
  }
  for (let k: i32 = 0; k < 20; k++) {
    echoRound(conn, c, toI64(k) * n64(100), warm);
  }
  const m = new NqMeter(false);
  for (let k: i32 = 20; k < 320; k++) {
    echoRound(conn, c, toI64(k) * n64(100), m);
  }
  t.eqI64("300 packets in and their echoes out, with ACKs and credit updates, keep no arena memory", m.kept, n64(0));
  const zero = conn.streams.find(n64(0));
  t.ok("and the echo is all there: 32,000 bytes sent back", zero !== null && zero.sendNext === n64(32000));
};

/**
 * Connection after connection through one slot: `reset` keeps nothing,
 * after its handshake a connection keeps nothing, and the handshake — which
 * allocates, for TLS-3 and its key derivations (`docs/security/quic.md`) —
 * keeps exactly as much each time from the second on, so nothing in the
 * slot grows with the connections it has served. The handshake is measured
 * with a `fresh` meter, since it crosses chunks.
 */
const perConnection = (t: Suite): void => {
  const limits = new NqLimits();
  const slot = new QuicConnection(nqConfig(limits), fixedEntropy());
  const handshakes: i64[] = [];
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
    const handshake = new NqMeter(true);
    if (meteredHandshake(slot, c, limits, handshake)) {
      connected++;
    }
    handshakes.push(handshake.kept);
    const rest = new NqMeter(false);
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
  t.eqI64("after its handshake a connection keeps none: ten echoes, a close", after, n64(0));
  let same: boolean = handshakes[1] > n64(0);
  for (let k: i32 = 2; k < toI32(handshakes.length); k++) {
    same = same && handshakes[k] === handshakes[1];
  }
  t.ok("and from the second on, each handshake through the slot keeps exactly as much: nothing in the slot grows", same);
};

/** Every arena check. */
export const arenaChecks = (t: Suite): void => {
  perPacket(t);
  perConnection(t);
};

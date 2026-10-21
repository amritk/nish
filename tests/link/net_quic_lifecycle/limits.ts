// The AEAD limits of RFC 9001 §6.6 and the skipped packet numbers of RFC
// 9000 §21.4 in `nish/net/quic` (QUIC-6, QUIC-7): a key update started
// before the confidentiality limit, the close when none can be, the close
// past the integrity limit, and an ACK of a packet number the server never
// sent. The limits are lowered on a connected server, the way a test may,
// so that a handful of packets reach them.
import { Suite } from "nish/testing";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QUIC_ERROR_AEAD_LIMIT_REACHED, QUIC_ERROR_PROTOCOL_VIOLATION, quicPushAck, quicPushPadding } from "nish/net/quic-frame";
import {
  QUIC_CONN_CONFIDENTIALITY_LIMIT,
  QUIC_CONN_INTEGRITY_LIMIT_CHACHA,
  QUIC_CONN_INTEGRITY_LIMIT_GCM,
  QUIC_CONN_SKIP_MIN,
  QUIC_CONN_SKIP_SPREAD,
  QUIC_STATE_CLOSING,
  QUIC_STATE_CONNECTED,
  QUIC_STATE_WAIT_INITIAL,
  QuicConnection,
} from "nish/net/quic";
import { QUIC_MAX_VARINT } from "nish/net/quic-packet";
import { TLS_AES_128_GCM_SHA256, TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { bytesOf, fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { CLIENT_SCID, QcClient, qcConnect, qcCrypto, qcHello, qcInitial, qcParams, qcShortWith } from "../net_quic_conn/client";
import { qcConnected, qcDefaultConfig, qcServer } from "../net_quic_conn/common";
import { qcStream } from "../net_quic_conn/data";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { lcCloseIn } from "./common";
import { LcGeneration, LcOpened, lcAck, lcNext, lcOpen, lcSend } from "./keys";

/** A connected server whose client has opened stream 0, so the server has a stream to write on. */
const llOpen = (conn: QuicConnection): QcClient => {
  const c: QcClient = qcConnected(conn, n64(65536));
  lcSend(conn, c, new LcGeneration(c.appWrite, c.appWriteSecret, false), c.appPn, qcStream(n64(0), n64(0), "open", false));
  return c;
};

/** The server's next datagram, with `text` written to stream 0 for it to carry. */
const llTake = (conn: QuicConnection, c: QcClient, text: string): u8[] | null => {
  conn.writeStream(n64(0), bytesOf(text), false);
  return conn.takeDatagram(c.now);
};

/** `packet` with its last byte, the AEAD tag's, flipped. */
const llForged = (packet: u8[]): u8[] => {
  const last: i32 = toI32(packet.length) - 1;
  if (last >= 0) {
    packet[last] = toU8(toI32(packet[last]) ^ 0x01);
  }
  return packet;
};

/** A 1-RTT packet of PING and padding that fails to authenticate, numbered `pn`. */
const llUnauthentic = (c: QcClient, pn: i64): u8[] => {
  const payload: u8[] = fromHex("01");
  quicPushPadding(payload, n32(40));
  return llForged(qcShortWith(c, c.appWrite, false, pn, payload));
};

/** An ACK of the server's packets `smallest` to `largest`. */
const llAckRange = (smallest: i64, largest: i64): u8[] => {
  const out: u8[] = [];
  quicPushAck(out, [smallest, largest], n32(1), n64(0));
  return out;
};

/** The limits the suite sets, under AES-128-GCM and under ChaCha20-Poly1305. */
const llSuiteLimits = (t: Suite): void => {
  const gcm: QuicConnection = qcServer(qcDefaultConfig());
  qcConnected(gcm, n64(65536));
  t.ok(
    "under AES-GCM a write key seals at most 2^23 packets and 2^52 may fail to authenticate (RFC 9001 §6.6)",
    gcm.confidentialityLimit === QUIC_CONN_CONFIDENTIALITY_LIMIT && gcm.integrityLimit === QUIC_CONN_INTEGRITY_LIMIT_GCM
  );
  const chacha: QuicConnection = qcServer(qcDefaultConfig());
  const scid: u8[] = fromHex(CLIENT_SCID);
  const c = new QcClient(TLS_CHACHA20_POLY1305_SHA256, scid);
  qcConnect(chacha, c, qcHello([TLS_CHACHA20_POLY1305_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536)))));
  t.ok(
    "under ChaCha20-Poly1305 2^36 may fail to authenticate, and no count of packets reaches its confidentiality limit",
    chacha.handshakeComplete && chacha.integrityLimit === QUIC_CONN_INTEGRITY_LIMIT_CHACHA && chacha.confidentialityLimit === QUIC_MAX_VARINT
  );
};

/** The confidentiality limit: a key update at three quarters of it, and a close at it when no update can be made. */
const llConfidentiality = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = llOpen(conn);
  const read0 = new LcGeneration(c.appRead, c.appReadSecret, false);
  const write0 = new LcGeneration(c.appWrite, c.appWriteSecret, false);
  const first: LcOpened = lcOpen(c, read0, llTake(conn, c, "a"));
  lcSend(conn, c, write0, c.appPn, lcAck(first.pn));
  conn.confidentialityLimit = n64(8);
  let at: i64 = -1;
  let opened: LcOpened = new LcOpened();
  for (let k: i32 = 0; k < 16 && at < toI64(0); k++) {
    const before: i64 = conn.sealedUnderKey;
    const out: u8[] | null = llTake(conn, c, "b");
    if (conn.writePhase) {
      at = before;
      opened = lcOpen(c, lcNext(read0), out);
    }
  }
  t.eqStr(
    "at three quarters of the confidentiality limit, 6 packets of 8, the server starts a key update (RFC 9001 §6.6)",
    `${at} ${opened.ok && opened.phase} ${conn.sealedUnderKey} ${conn.state === QUIC_STATE_CONNECTED}`,
    "6 true 1 true"
  );

  const stuck: QuicConnection = qcServer(qcDefaultConfig());
  const s: QcClient = llOpen(stuck);
  const sRead0 = new LcGeneration(s.appRead, s.appReadSecret, false);
  stuck.confidentialityLimit = stuck.sealedUnderKey + n64(4);
  let sent: i32 = 0;
  for (let k: i32 = 0; k < 8; k++) {
    if (lcOpen(s, sRead0, llTake(stuck, s, "c")).ok) {
      sent = sent + 1;
    }
  }
  t.eqStr(
    "with no update possible, the key seals up to the limit and the connection closes with AEAD_LIMIT_REACHED, sealing nothing more, its close included",
    `${sent} ${stuck.writePhase} ${stuck.state === QUIC_STATE_CLOSING} ${stuck.error} ${stuck.takeDatagram(s.now) === null}`,
    `4 false true ${QUIC_ERROR_AEAD_LIMIT_REACHED} true`
  );
};

/** The integrity limit: packets that fail to authenticate, counted over the connection, and a first Initial that is not. */
const llIntegrity = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = qcConnected(conn, n64(65536));
  const read0 = new LcGeneration(c.appRead, c.appReadSecret, false);
  const write0 = new LcGeneration(c.appWrite, c.appWriteSecret, false);
  conn.integrityLimit = n64(2);
  lcSend(conn, c, write0, c.appPn, fromHex("01"));
  conn.receive(llUnauthentic(c, c.appPn), c.now);
  conn.receive(llUnauthentic(c, c.appPn + n64(1)), c.now);
  t.ok(
    "packets that fail to authenticate are counted, and up to the integrity limit the connection stays",
    conn.authFailures === toI64(2) && conn.state === QUIC_STATE_CONNECTED
  );
  conn.receive(llUnauthentic(c, c.appPn + n64(2)), c.now);
  t.eqStr(
    "the next past the limit closes it with AEAD_LIMIT_REACHED (RFC 9001 §6.6)",
    `${conn.state === QUIC_STATE_CLOSING} ${lcCloseIn([lcOpen(c, read0, conn.takeDatagram(c.now)).payload])}`,
    `true ${QUIC_ERROR_AEAD_LIMIT_REACHED} 0`
  );

  const fresh: QuicConnection = qcServer(qcDefaultConfig());
  fresh.integrityLimit = n64(0);
  const scid: u8[] = fromHex(CLIENT_SCID);
  const f = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536))));
  fresh.receive(llForged(qcInitial(f, qcCrypto(n64(0), hello), n32(1200))), f.now);
  t.ok("a first Initial that fails to authenticate is not counted: no connection is started", fresh.authFailures === toI64(0) && fresh.state === QUIC_STATE_WAIT_INITIAL);
};

/** Skipped packet numbers (RFC 9000 §21.4): never sent, and an ACK of one closes the connection. */
const llSkips = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = llOpen(conn);
  const read0 = new LcGeneration(c.appRead, c.appReadSecret, false);
  const write0 = new LcGeneration(c.appWrite, c.appWriteSecret, false);
  const most: i64 = QUIC_CONN_SKIP_MIN + QUIC_CONN_SKIP_SPREAD - n64(1);
  const due: i64 = conn.nextSkip - conn.application.nextPn;
  t.ok("once the 1-RTT keys are in, a packet number is due to be skipped 128 to 1024 packets on (RFC 9000 §21.4)", due >= QUIC_CONN_SKIP_MIN && due <= most);

  const skip: i64 = conn.application.nextPn;
  conn.nextSkip = skip;
  const opened: LcOpened = lcOpen(c, read0, llTake(conn, c, "d"));
  const next: i64 = conn.nextSkip - (skip + n64(1));
  t.ok("the number due is never sent: the next packet carries the one after", opened.ok && opened.pn === skip + n64(1));
  t.ok("and the next skip is drawn 128 to 1024 packets on again", next >= QUIC_CONN_SKIP_MIN && next <= most);

  lcSend(conn, c, write0, c.appPn, lcAck(opened.pn));
  t.ok("an ACK of the packets sent around it is read", conn.state === QUIC_STATE_CONNECTED);
  lcSend(conn, c, write0, c.appPn, llAckRange(skip - n64(1), opened.pn));
  t.eqStr(
    "an ACK that takes in the skipped number is PROTOCOL_VIOLATION, an optimistic ACK",
    `${conn.state === QUIC_STATE_CLOSING} ${lcCloseIn([lcOpen(c, read0, conn.takeDatagram(c.now)).payload])}`,
    `true ${QUIC_ERROR_PROTOCOL_VIOLATION} 2`
  );
};

/**
 * An optimistic ACK that hides the skipped number below its first range: two
 * ranges, `[skip + 3]` and `[skip - 1, skip + 1]`, read only when the second
 * leaves the skip out.
 */
const llSkipLaterRange = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = llOpen(conn);
  const read0 = new LcGeneration(c.appRead, c.appReadSecret, false);
  const write0 = new LcGeneration(c.appWrite, c.appWriteSecret, false);
  const skip: i64 = conn.application.nextPn;
  conn.nextSkip = skip;
  const first: LcOpened = lcOpen(c, read0, llTake(conn, c, "a"));
  lcOpen(c, read0, llTake(conn, c, "b"));
  const third: LcOpened = lcOpen(c, read0, llTake(conn, c, "c"));
  const top: i64 = skip + n64(3);
  const honest: u8[] = [];
  quicPushAck(honest, [top, top, first.pn, first.pn], n32(2), n64(0));
  lcSend(conn, c, write0, c.appPn, honest);
  t.ok(
    "an ACK of two ranges, neither taking in the skipped number, is read",
    first.pn === skip + n64(1) && third.pn === top && conn.state === QUIC_STATE_CONNECTED
  );
  const lying: u8[] = [];
  quicPushAck(lying, [top, top, skip - n64(1), first.pn], n32(2), n64(0));
  lcSend(conn, c, write0, c.appPn, lying);
  t.eqStr(
    "an ACK that takes in the skipped number in its second range is PROTOCOL_VIOLATION too",
    `${conn.state === QUIC_STATE_CLOSING} ${lcCloseIn([lcOpen(c, read0, conn.takeDatagram(c.now)).payload])}`,
    `true ${QUIC_ERROR_PROTOCOL_VIOLATION} 2`
  );
};

/**
 * The ring holds more than the last skip: two numbers skipped on one
 * connection, `a` and `b = a + 2`, and an ACK that takes in only the older,
 * `a`, is still refused.
 */
const llSkipRing = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = llOpen(conn);
  const read0 = new LcGeneration(c.appRead, c.appReadSecret, false);
  const write0 = new LcGeneration(c.appWrite, c.appWriteSecret, false);
  const a: i64 = conn.application.nextPn;
  conn.nextSkip = a;
  const first: LcOpened = lcOpen(c, read0, llTake(conn, c, "a"));
  const b: i64 = conn.application.nextPn;
  conn.nextSkip = b;
  const second: LcOpened = lcOpen(c, read0, llTake(conn, c, "b"));
  const honest: u8[] = [];
  quicPushAck(honest, [second.pn, second.pn, first.pn, first.pn], n32(2), n64(0));
  lcSend(conn, c, write0, c.appPn, honest);
  t.ok(
    "two numbers skipped on one connection are both remembered, and an ACK of the packets around them is read",
    b === a + n64(2) && first.pn === a + n64(1) && second.pn === a + n64(3) && conn.skipHead === 2 && conn.state === QUIC_STATE_CONNECTED
  );
  const lying: u8[] = [];
  quicPushAck(lying, [second.pn, second.pn, a - n64(1), first.pn], n32(2), n64(0));
  lcSend(conn, c, write0, c.appPn, lying);
  t.eqStr(
    "an ACK that takes in the older skipped number and not the newer is PROTOCOL_VIOLATION",
    `${conn.state === QUIC_STATE_CLOSING} ${lcCloseIn([lcOpen(c, read0, conn.takeDatagram(c.now)).payload])}`,
    `true ${QUIC_ERROR_PROTOCOL_VIOLATION} 2`
  );
};

/**
 * A reused slot (QUIC-3) starts its next connection with none of the last
 * one's skips, counts or lowered limits: the next client's ACK of the
 * number the last connection skipped is read.
 */
const llSlotReset = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = llOpen(conn);
  conn.integrityLimit = n64(4);
  conn.confidentialityLimit = n64(1000);
  const skip: i64 = conn.application.nextPn;
  conn.nextSkip = skip;
  const opened: LcOpened = lcOpen(c, new LcGeneration(c.appRead, c.appReadSecret, false), llTake(conn, c, "a"));
  conn.receive(llUnauthentic(c, c.appPn), c.now);
  const before: boolean = opened.pn === skip + n64(1) && conn.authFailures === toI64(1) && conn.sealedUnderKey > toI64(0) && conn.skipHead === 1;
  conn.reset(fixedEntropy());
  t.ok(
    "reset forgets the skipped numbers and zeroes the counts, and the limits are AES-GCM's again",
    before &&
      conn.authFailures === toI64(0) &&
      conn.sealedUnderKey === toI64(0) &&
      conn.nextSkip === toI64(-1) &&
      conn.skipsDrawn === toI64(0) &&
      conn.skipHead === 0 &&
      conn.confidentialityLimit === QUIC_CONN_CONFIDENTIALITY_LIMIT &&
      conn.integrityLimit === QUIC_CONN_INTEGRITY_LIMIT_GCM
  );
  const d: QcClient = llOpen(conn);
  const again: LcOpened = lcOpen(d, new LcGeneration(d.appRead, d.appReadSecret, false), llTake(conn, d, "b"));
  lcSend(conn, d, new LcGeneration(d.appWrite, d.appWriteSecret, false), d.appPn, llAckRange(n64(0), again.pn));
  t.ok(
    "on the reused slot the next connection sends the number the last one skipped, and an ACK of it is read",
    again.ok && again.pn === skip && conn.skipsDrawn === toI64(1) && conn.state === QUIC_STATE_CONNECTED
  );
};

/** Every AEAD-limit and skipped-packet-number check. */
export const limitChecks = (t: Suite): void => {
  llSuiteLimits(t);
  llConfidentiality(t);
  llIntegrity(t);
  llSkips(t);
  llSkipLaterRange(t);
  llSkipRing(t);
  llSlotReset(t);
};

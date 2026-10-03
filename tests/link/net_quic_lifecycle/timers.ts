// The idle timeout of `nish/net/quic` (RFC 9000 §10.1): the effective value
// from both sides' `max_idle_timeout`, its floor, what restarts it, and the
// silent close when it passes, driven by a hand-held clock.
import { Suite } from "nish/testing";
import { QuicKeys } from "nish/net/quic-packet";
import { quicEncodeTransportParameters, QuicTransportParameters } from "nish/net/quic-conn-params";
import {
  QUIC_CONN_IDLE_FLOOR,
  QUIC_STATE_CONNECTED,
  QUIC_STATE_HANDSHAKE,
  QUIC_STATE_TIMED_OUT,
  QuicConnection,
  QuicServerConfig,
} from "nish/net/quic";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { bytesOf, fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { CLIENT_SCID, QC_T0, QcClient, qcConnect, qcCrypto, qcExchange, qcHello, qcInitial, qcParams, qcShort } from "../net_quic_conn/client";
import { qcConfig, qcServer } from "../net_quic_conn/common";
import { qcStream } from "../net_quic_conn/data";
import { lcAllZero } from "./common";

/** A connection and the client that completed a handshake with it. */
class LcPair {
  conn: QuicConnection;
  c: QcClient;

  constructor(conn: QuicConnection, c: QcClient) {
    this.conn = conn;
    this.c = c;
  }
}

/** The client's ClientHello, advertising `clientIdle` as its `max_idle_timeout`. */
const lcIdleHello = (clientIdle: i64): u8[] => {
  const scid: u8[] = fromHex(CLIENT_SCID);
  const p: QuicTransportParameters = qcParams(scid, n64(65536));
  p.maxIdleTimeout = clientIdle;
  return qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(p));
};

/** A server advertising `serverIdle` and a client advertising `clientIdle`, connected at `QC_T0`. */
const lcIdlePair = (serverIdle: i64, clientIdle: i64): LcPair => {
  const config: QuicServerConfig = qcConfig(n64(65536), n64(16384), n64(4), n64(4));
  config.maxIdleTimeout = serverIdle;
  const conn: QuicConnection = qcServer(config);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  qcConnect(conn, c, lcIdleHello(clientIdle));
  return new LcPair(conn, c);
};

/** A PING in a 1-RTT packet: the least a client sends to keep a connection alive. */
const lcPing = (c: QcClient): u8[] => qcShort(c, fromHex("01"));

/** Every idle-timeout check. */
export const timerChecks = (t: Suite): void => {
  const fresh: QuicConnection = qcServer(qcConfig(n64(65536), n64(16384), n64(4), n64(4)));
  t.eqI64("a connection that has read nothing has no deadline", fresh.deadline(), n64(-1));

  const p: LcPair = lcIdlePair(n64(30000), n64(0));
  t.eqI32("connected at 1000 ms", p.conn.state, QUIC_STATE_CONNECTED);
  t.eqI64("with only the server's 30 s advertised, the deadline is 30 s after the last packet", p.conn.deadline(), QC_T0 + n64(30000));
  const writeKeys: QuicKeys | null = p.conn.application.writeKeys;
  p.conn.handleTimer(QC_T0 + n64(29999));
  t.eqI32("a millisecond before it, the connection is alive", p.conn.state, QUIC_STATE_CONNECTED);
  p.conn.handleTimer(QC_T0 + n64(30000));
  t.eqI32("at it, the connection has timed out", p.conn.state, QUIC_STATE_TIMED_OUT);
  t.ok("silently: nothing goes out, not even a CONNECTION_CLOSE (§10.1)", p.conn.takeDatagram(QC_T0 + n64(30000)) === null);
  t.ok("its keys are discarded and wiped", p.conn.application.discarded && writeKeys !== null && lcAllZero(writeKeys.key) && lcAllZero(writeKeys.hp));
  t.ok("and nothing is timed any more", p.conn.deadline() === n64(-1));
  p.conn.receive(qcShort(p.c, qcStream(n64(0), n64(0), "late", true)), QC_T0 + n64(30001));
  t.ok("a packet after that is ignored", p.conn.readStream() === null && p.conn.state === QUIC_STATE_TIMED_OUT);

  t.eqI64("the client's 5 s, smaller, wins (§10.1)", lcIdlePair(n64(30000), n64(5000)).conn.deadline(), QC_T0 + n64(5000));
  t.eqI64("a 1 s timeout is raised to three probe timeouts", lcIdlePair(n64(30000), n64(1000)).conn.deadline(), QC_T0 + QUIC_CONN_IDLE_FLOOR);
  t.eqI64("with the server's 0, the client's 8 s alone", lcIdlePair(n64(0), n64(8000)).conn.deadline(), QC_T0 + n64(8000));
  const forever: LcPair = lcIdlePair(n64(0), n64(0));
  forever.conn.handleTimer(QC_T0 + n64(1000000000));
  t.ok("with neither advertising one there is no timeout at all", forever.conn.deadline() === n64(-1) && forever.conn.state === QUIC_STATE_CONNECTED);

  const r: LcPair = lcIdlePair(n64(30000), n64(0));
  r.c.now = QC_T0 + n64(20000);
  qcExchange(r.conn, r.c, lcPing(r.c));
  t.eqI64("a packet received restarts the timer", r.conn.deadline(), QC_T0 + n64(50000));
  r.c.now = QC_T0 + n64(500);
  qcExchange(r.conn, r.c, lcPing(r.c));
  t.eqI64("time handed in out of order does not run the clock backwards", r.conn.deadline(), QC_T0 + n64(50000));

  const s: LcPair = lcIdlePair(n64(30000), n64(0));
  s.c.now = QC_T0 + n64(1000);
  qcExchange(s.conn, s.c, qcShort(s.c, qcStream(n64(0), n64(0), "ping", false)));
  t.eqI64("the stream data restarts it, and the bare ACK the server answers with does not", s.conn.deadline(), QC_T0 + n64(31000));
  s.conn.writeStream(n64(0), bytesOf("pong"), false);
  s.conn.takeDatagram(QC_T0 + n64(4000));
  t.eqI64("the server's first ack-eliciting packet since restarts it", s.conn.deadline(), QC_T0 + n64(34000));
  s.conn.writeStream(n64(0), bytesOf("pong"), false);
  s.conn.takeDatagram(QC_T0 + n64(7000));
  t.eqI64("its second does not (§10.1)", s.conn.deadline(), QC_T0 + n64(34000));

  const late: LcPair = lcIdlePair(n64(30000), n64(0));
  late.conn.receive(qcShort(late.c, qcStream(n64(0), n64(0), "late", true)), QC_T0 + n64(30000));
  t.ok("a datagram handed in at the deadline finds the connection timed out, and is not read", late.conn.state === QUIC_STATE_TIMED_OUT && late.conn.readStream() === null);

  const half: QuicConnection = qcServer(qcConfig(n64(65536), n64(16384), n64(4), n64(4)));
  const h = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  half.receive(qcInitial(h, qcCrypto(n64(0), lcIdleHello(n64(0))), n32(1200)), QC_T0);
  t.eqI32("a handshake the client abandons", half.state, QUIC_STATE_HANDSHAKE);
  half.handleTimer(QC_T0 + n64(30000));
  t.eqI32("times out too", half.state, QUIC_STATE_TIMED_OUT);
};

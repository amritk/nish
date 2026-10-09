// The server's handshake flight under loss (QUIC-8): a probe timeout sends
// it twice, so one more lost datagram does not cost another doubled probe
// timeout (RFC 9002 §6.2.4); a client that shows it lacks it gets it again
// at once, a bounded number of times (§6.2.3); and the anti-amplification
// limit holds both (RFC 9000 §8.1). The clock starts at an epoch time in
// milliseconds, as a carrier's does, and the network is the test: it drops
// what the check says it drops and nothing else.
import { Suite } from "nish/testing";
import { QUIC_FRAME_CRYPTO, QUIC_FRAME_PING, quicPushTypeOnly } from "nish/net/quic-frame";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QUIC_CONN_EARLY_RESENDS, QUIC_STATE_CONNECTED, QuicConnection } from "nish/net/quic";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import {
  CLIENT_SCID,
  QcClient,
  qcCrypto,
  qcExchange,
  qcFinishedPacket,
  qcHandshake,
  qcHello,
  qcInitial,
  qcParams,
  qcReadFlight,
  qcReceive,
} from "../net_quic_conn/client";
import { qcDefaultConfig, qcServer } from "../net_quic_conn/common";
import { rcAck, rcCount, rcLose, rcSign } from "./conn";

/** When every check here starts: 2025-10-09 in milliseconds since the epoch. */
const HS_T0: i64 = 1760000000000;
/** The first probe timeout with no RTT sample: kInitialRtt 333 + 4 × 166 ms (RFC 9002 §6.2.1). */
const HS_PTO: i64 = 997;

/** A client and its ClientHello, the client's clock at `HS_T0`. */
class HsPair {
  conn: QuicConnection;
  c: QcClient;
  hello: u8[];

  constructor() {
    this.conn = qcServer(qcDefaultConfig());
    const scid: u8[] = fromHex(CLIENT_SCID);
    this.c = new QcClient(TLS_AES_128_GCM_SHA256, scid);
    this.c.now = HS_T0;
    this.hello = qcHello(
      [TLS_AES_128_GCM_SHA256],
      "nish-echo",
      quicEncodeTransportParameters(qcParams(scid, n64(65536)))
    );
    this.c.before = this.hello;
  }
}

/** The ClientHello sent in a 1200-byte Initial, the server signing as asked, and its whole first flight lost. Answers the datagrams lost. */
const hsLoseFlight = (p: HsPair): i32 => {
  p.conn.receive(qcInitial(p.c, qcCrypto(n64(0), p.hello), n32(1200)), p.c.now);
  rcSign(p.conn);
  return rcLose(p.conn, p.c.now);
};

/** Takes the server's next datagram and delivers it to the client. Answers whether there was one. */
const hsDeliver = (p: HsPair): boolean => {
  const out: u8[] | null = p.conn.takeDatagram(p.c.now);
  if (out === null) {
    return false;
  }
  p.c.datagrams.push(out);
  qcReceive(p.c, out);
  return true;
};

/** How many of the client's long-header payloads from `from` on carry a CRYPTO frame. */
const hsCryptoPayloads = (c: QcClient, from: i32): i32 => {
  let n: i32 = 0;
  for (let k: i32 = from; k < toI32(c.longPayloads.length); k++) {
    if (k >= 0 && rcCount(c.longPayloads[k], QUIC_FRAME_CRYPTO) > n32(0)) {
      n++;
    }
  }
  return n;
};

/** The client's Finished, which completes the handshake once it has read the flight from `c.datagrams[from ..]`. */
const hsFinish = (p: HsPair, from: i32): boolean => {
  if (!qcReadFlight(p.c, from, n32(0))) {
    return false;
  }
  qcExchange(p.conn, p.c, qcFinishedPacket(p.c));
  return p.conn.state === QUIC_STATE_CONNECTED;
};

/**
 * Defect 3 of the interop runner's `handshakeloss` case against quic-go: the
 * first flight lost, and of the first probe timeout's datagrams every one
 * but the last. With one probe a probe timeout, the client had nothing until
 * the second, at three probe timeouts; now it completes at the first.
 */
const hsSecondProbeArrives = (t: Suite): void => {
  const p = new HsPair();
  t.eqI32("the first flight is one datagram, and the network loses it", hsLoseFlight(p), n32(1));
  t.eqI64("the probe timeout is 997 ms after it", p.conn.deadline(), HS_T0 + HS_PTO);
  p.c.now = p.conn.deadline();
  p.conn.handleTimer(p.c.now);
  const lost: u8[] | null = p.conn.takeDatagram(p.c.now);
  t.ok("the first probe goes out, and the network loses it too", lost !== null);
  const from: i32 = toI32(p.c.datagrams.length);
  t.ok("a second probe follows it at the same probe timeout", hsDeliver(p));
  t.ok("and a third does not", p.conn.takeDatagram(p.c.now) === null);
  // With one probe a probe timeout, that one was lost here, and the next
  // came a doubled probe timeout later, 997 × 3 ms after the flight.
  t.ok(
    "from the second alone the client completes the handshake, at the first probe timeout",
    hsFinish(p, from) && p.c.now === HS_T0 + HS_PTO
  );
};

/** Both datagrams of a handshake probe elicit an acknowledgement, and carry the flight's CRYPTO data (§6.2.4). */
const hsProbePair = (t: Suite): void => {
  const p = new HsPair();
  hsLoseFlight(p);
  p.c.now = HS_T0 + HS_PTO;
  p.conn.handleTimer(p.c.now);
  const from: i32 = toI32(p.c.datagrams.length);
  const initialFrom: i32 = toI32(p.c.longPayloads.length);
  t.ok("a probe timeout during the handshake sends one datagram", hsDeliver(p));
  t.ok("and a second", hsDeliver(p));
  t.ok("and no more", p.conn.takeDatagram(p.c.now) === null);
  t.eqI32(
    "the Initial of each carries the ServerHello, which elicits an ACK",
    hsCryptoPayloads(p.c, initialFrom),
    n32(2)
  );
  // Read with the handshake keys, both datagrams open in full: an Initial and a Handshake packet each.
  t.ok("the client accepts the flight", qcReadFlight(p.c, from, n32(0)));
  t.eqI32("each datagram's Handshake packet carries CRYPTO data too", hsCryptoPayloads(p.c, n32(0)), n32(4));
  qcExchange(p.conn, p.c, qcFinishedPacket(p.c));
  t.eqI32("and the handshake completes", p.conn.state, QUIC_STATE_CONNECTED);
};

/**
 * A client Initial repeating the ClientHello, which the server already read,
 * shows the client did not get the server's Initial flight: the server sends
 * it again at once, before any probe timeout, at most `QUIC_CONN_EARLY_RESENDS`
 * times a connection (§6.2.3).
 */
const hsDuplicateHello = (t: Suite): void => {
  const p = new HsPair();
  hsLoseFlight(p);
  const from: i32 = toI32(p.c.datagrams.length);
  let payloads: i32 = toI32(p.c.longPayloads.length);
  p.c.now = HS_T0 + n64(300);
  p.conn.receive(qcInitial(p.c, qcCrypto(n64(0), p.hello), n32(1200)), p.c.now);
  t.ok("a repeated ClientHello brings the flight again at once", hsDeliver(p));
  t.eqI32("its Initial carries the ServerHello", hsCryptoPayloads(p.c, payloads), n32(1));
  t.ok("in one datagram", p.conn.takeDatagram(p.c.now) === null);
  t.eqI32("with no probe timeout", p.conn.recovery.ptoCount, n32(0));
  payloads = toI32(p.c.longPayloads.length);
  p.c.now = HS_T0 + n64(400);
  p.conn.receive(qcInitial(p.c, qcCrypto(n64(0), p.hello), n32(1200)), p.c.now);
  t.ok("a second before any ACK brings one more", hsDeliver(p));
  t.ok("one", p.conn.takeDatagram(p.c.now) === null);
  t.eqI32("with the ServerHello again", hsCryptoPayloads(p.c, payloads), n32(1));
  t.eqI32("which is QUIC_CONN_EARLY_RESENDS of them", p.conn.earlyResends, QUIC_CONN_EARLY_RESENDS);
  payloads = toI32(p.c.longPayloads.length);
  p.c.now = HS_T0 + n64(500);
  p.conn.receive(qcInitial(p.c, qcCrypto(n64(0), p.hello), n32(1200)), p.c.now);
  t.ok("a third is answered", hsDeliver(p));
  t.eqI32("with an ACK alone: the cap is reached", hsCryptoPayloads(p.c, payloads), n32(0));
  t.ok("and nothing more", p.conn.takeDatagram(p.c.now) === null);
  t.ok("the client completes the handshake from an early copy", hsFinish(p, from));
};

/** What does not ask for the flight early: a PING, and a repeat once the flight is acknowledged. */
const hsNoEarlyResend = (t: Suite): void => {
  const p = new HsPair();
  hsLoseFlight(p);
  const ping: u8[] = [];
  quicPushTypeOnly(ping, QUIC_FRAME_PING);
  let payloads: i32 = toI32(p.c.longPayloads.length);
  p.c.now = HS_T0 + n64(300);
  p.conn.receive(qcInitial(p.c, ping, n32(1200)), p.c.now);
  t.ok("a PING in an Initial is acknowledged", hsDeliver(p));
  t.eqI32("but repeats nothing the server read, so the flight waits for the probe timeout", hsCryptoPayloads(p.c, payloads), n32(0));
  t.eqI32("and no early resend is spent", p.conn.earlyResends, n32(0));

  const q = new HsPair();
  q.conn.receive(qcInitial(q.c, qcCrypto(n64(0), q.hello), n32(1200)), q.c.now);
  rcSign(q.conn);
  const from: i32 = toI32(q.c.datagrams.length);
  hsDeliver(q);
  qcReadFlight(q.c, from, n32(0));
  q.conn.receive(qcInitial(q.c, rcAck(n64(0), q.c.largestInitial, n64(0)), n32(1200)), q.c.now);
  payloads = toI32(q.c.longPayloads.length);
  q.conn.receive(qcInitial(q.c, qcCrypto(n64(0), q.hello), n32(1200)), q.c.now);
  hsDeliver(q);
  t.eqI32("a repeated ClientHello once the server's Initial is acknowledged brings no CRYPTO data", hsCryptoPayloads(q.c, payloads), n32(0));
  t.eqI32("nor spends an early resend", q.conn.earlyResends, n32(0));
};

/**
 * An ack-eliciting Handshake packet while the server's Handshake data is in
 * flight: the client has the Handshake keys but may not have the rest, so
 * the server's Handshake data goes again at once. One that acknowledges it
 * all asks for nothing.
 */
const hsHandshakePing = (t: Suite): void => {
  const p = new HsPair();
  p.conn.receive(qcInitial(p.c, qcCrypto(n64(0), p.hello), n32(1200)), p.c.now);
  rcSign(p.conn);
  const from: i32 = toI32(p.c.datagrams.length);
  hsDeliver(p);
  qcReadFlight(p.c, from, n32(0));
  const ping: u8[] = [];
  quicPushTypeOnly(ping, QUIC_FRAME_PING);
  let payloads: i32 = toI32(p.c.longPayloads.length);
  p.c.now = HS_T0 + n64(50);
  p.conn.receive(qcHandshake(p.c, ping), p.c.now);
  t.ok("a Handshake PING with the server's Handshake data unacknowledged", hsDeliver(p));
  t.eqI32("brings that data again at once", hsCryptoPayloads(p.c, payloads), n32(1));
  t.ok("in one datagram", p.conn.takeDatagram(p.c.now) === null);
  const acked: u8[] = rcAck(n64(0), p.c.largestHandshake, n64(0));
  quicPushTypeOnly(acked, QUIC_FRAME_PING);
  payloads = toI32(p.c.longPayloads.length);
  p.conn.receive(qcHandshake(p.c, acked), p.c.now);
  hsDeliver(p);
  t.eqI32("one that acknowledges it all brings no CRYPTO data", hsCryptoPayloads(p.c, payloads), n32(0));
  t.eqI32("and spends no early resend", p.conn.earlyResends, n32(1));
  qcExchange(p.conn, p.c, qcFinishedPacket(p.c));
  t.eqI32("the handshake completes", p.conn.state, QUIC_STATE_CONNECTED);
};

/**
 * Before the client's address is validated the server sends at most three
 * times what it received (RFC 9000 §8.1), probes included: a probe the limit
 * forbids waits, owed, until the client sends more.
 */
const hsAmplification = (t: Suite): void => {
  const p = new HsPair();
  hsLoseFlight(p);
  t.eqI64("1200 bytes in allow 3600 out, and the flight took 1200", p.conn.bytesSent, n64(1200));
  p.c.now = HS_T0 + HS_PTO;
  p.conn.handleTimer(p.c.now);
  t.eqI32("the first probe timeout's two datagrams fit what is left", rcLose(p.conn, p.c.now), n32(2));
  t.eqI64("exactly", p.conn.bytesSent, n64(3600));
  t.ok("so the server is blocked", p.conn.amplificationBlocked());
  // Past where the second probe timeout would be, 997 + 2 × 997 ms after the flight.
  p.c.now = HS_T0 + n64(4000);
  p.conn.handleTimer(p.c.now);
  t.eqI32("and arms no probe timeout while it is (RFC 9002 §6.2.2.1)", p.conn.recovery.ptoCount, n32(1));
  t.ok("so it has still sent nothing", p.conn.takeDatagram(p.c.now) === null);
  const none: u8[] = [];
  p.conn.receive(qcInitial(p.c, none, n32(500)), p.c.now);
  t.ok("500 bytes of PADDING from the client unblock it", !p.conn.amplificationBlocked());
  t.eqI32("and the second probe timeout, already past, fires", p.conn.recovery.ptoCount, n32(2));
  t.eqI32("and of its two datagrams the limit lets one go", rcLose(p.conn, p.c.now), n32(1));
  t.ok("the server never sends more than three times what it received", p.conn.bytesSent <= p.conn.bytesReceived * n64(3));
  t.ok("the other is still owed", p.conn.handshake.probes === n32(1) && p.conn.initial.probes === n32(1));
  p.conn.receive(qcInitial(p.c, none, n32(500)), p.c.now);
  t.eqI32("and goes once the client sends more", rcLose(p.conn, p.c.now), n32(1));
  t.ok("still inside the limit", p.conn.bytesSent <= p.conn.bytesReceived * n64(3));
};

/** Every check of the handshake flight under loss. */
export const recoveryHandshakeChecks = (t: Suite): void => {
  hsSecondProbeArrives(t);
  hsProbePair(t);
  hsDuplicateHello(t);
  hsNoEarlyResend(t);
  hsHandshakePing(t);
  hsAmplification(t);
};

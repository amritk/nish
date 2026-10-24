// The listener's flights and ECN (RFC 9000 §13.4): one `udpSendTo` marks
// every datagram of a GSO flight with one codepoint, so a flight ends where
// the connection's marking would change, at the end of the ten testing
// packets, and the packets counted as marked are exactly those of the flight
// sent marked.
import { Suite } from "nish/testing";
import { QUIC_CONN_DATAGRAM_SIZE } from "nish/net/quic";
import { QUIC_LISTENER_FLIGHT_MAX, QuicFlight, quicListenerTakeFlight } from "nish/net/quic-listener";
import { QUIC_RECOVERY_APPLICATION, QUIC_RECOVERY_ECN_TESTING_PACKETS, QuicSentPackets } from "nish/net/quic-recovery";
import { bytesOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { NqLimits, NqPair, NqRead, nqPair, nqReadAll, nqSend, nqText } from "../net_quic_stream/common";
import { qcStream } from "../net_quic_conn/data";

const ECT0: i32 = 2;

/** A flight that would cross the end of the testing packets is cut there: marked, then unmarked. */
const testingEnds = (t: Suite): void => {
  const limits = new NqLimits();
  limits.maxStreamData = n64(16384);
  const p: NqPair = nqPair(limits);
  nqSend(p, qcStream(n64(0), n64(0), "send", false));
  nqReadAll(p.conn, n32(64), new NqRead());
  p.conn.ecnMarking = true;
  p.conn.recovery.ecnTestSent = QUIC_RECOVERY_ECN_TESTING_PACKETS - n32(3);
  const data: u8[] = bytesOf(nqText(n32(8000)));
  p.conn.streamWrite(n64(0), data, n32(0), n32(8000), true);
  const app: QuicSentPackets = p.conn.recovery.spaces[QUIC_RECOVERY_APPLICATION];
  const before: i64 = app.ectSent;
  const buf: u8[] = new Array<u8>(QUIC_LISTENER_FLIGHT_MAX * QUIC_CONN_DATAGRAM_SIZE);
  const first = new QuicFlight();
  quicListenerTakeFlight(p.conn, p.c.now, buf, n32(0), toI32(buf.length), first);
  t.eqI32("three testing packets left, the flight is the three", first.count, n32(3));
  t.eqI32("sent ECT(0)", first.ecn, ECT0);
  t.ok("and all three counted as marked", app.ectSent - before === n64(3));
  const second = new QuicFlight();
  quicListenerTakeFlight(p.conn, p.c.now, buf, n32(0), toI32(buf.length), second);
  t.eqI32("the next flight is the other four", second.count, n32(4));
  t.eqI32("sent unmarked", second.ecn, n32(0));
  t.ok("and none of them counted as marked", app.ectSent - before === n64(3));
};

/** A connection whose carrier does not mark sends unmarked flights, whole. */
const unmarked = (t: Suite): void => {
  const limits = new NqLimits();
  limits.maxStreamData = n64(16384);
  const p: NqPair = nqPair(limits);
  nqSend(p, qcStream(n64(0), n64(0), "send", false));
  nqReadAll(p.conn, n32(64), new NqRead());
  const data: u8[] = bytesOf(nqText(n32(8000)));
  p.conn.streamWrite(n64(0), data, n32(0), n32(8000), true);
  const buf: u8[] = new Array<u8>(QUIC_LISTENER_FLIGHT_MAX * QUIC_CONN_DATAGRAM_SIZE);
  const flight = new QuicFlight();
  quicListenerTakeFlight(p.conn, p.c.now, buf, n32(0), toI32(buf.length), flight);
  t.eqI32("without ecnMarking the flight is all seven", flight.count, n32(7));
  t.eqI32("unmarked", flight.ecn, n32(0));
  t.ok("and no packet counted as marked", p.conn.recovery.spaces[QUIC_RECOVERY_APPLICATION].ectSent === n64(0));
};

export const quicEcnChecks = (): i32 => {
  const t = new Suite("quic ecn flights");
  testingEnds(t);
  unmarked(t);
  return t.done();
};

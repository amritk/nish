// The listener's flights and ECN (RFC 9000 §13.4): one `udpSendTo` marks
// every datagram of a GSO flight with one codepoint, so a flight ends where
// the connection's marking would change, at the end of the ten testing
// packets, and the packets counted as marked are exactly those of the flight
// sent marked. On the receiving side (§13.4.1) the server counts the ECN
// bits each packet arrived with, per packet number space and never for a
// duplicate, and echoes the counts in an ACK_ECN.
import { Suite } from "nish/testing";
import { QUIC_CONN_DATAGRAM_SIZE, QuicConnection } from "nish/net/quic";
import { QuicAckRanges } from "nish/net/quic-conn-ack";
import {
  QUIC_FRAME_ACK,
  QUIC_FRAME_ACK_ECN,
  QUIC_FRAME_PING,
  QuicFrame,
  quicAckEcnSize,
  quicParseFrame,
  quicPushAckEcn,
  quicPutAckEcn,
} from "nish/net/quic-frame";
import { QUIC_LISTENER_FLIGHT_MAX, QuicFlight, quicListenerTakeFlight } from "nish/net/quic-listener";
import { QUIC_RECOVERY_APPLICATION, QUIC_RECOVERY_ECN_TESTING_PACKETS, QuicSentPackets } from "nish/net/quic-recovery";
import { bytesOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { NqLimits, NqPair, NqRead, nqConfig, nqConnect, nqPair, nqReadAll, nqSend, nqText } from "../net_quic_stream/common";
import { qcStream } from "../net_quic_conn/data";
import { QcClient, qcExchange, qcShort } from "../net_quic_conn/client";
import { fixedEntropy } from "../net_quic_conn_replay/server";

const ECT0: i32 = 2;
const ECT1: i32 = 1;
const CE: i32 = 3;

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

/** The first ACK or ACK_ECN frame in `payload`, parsed into `into`; false when there is none. */
const ackOf = (payload: u8[], into: QuicFrame): boolean => {
  let at: i32 = 0;
  while (at < toI32(payload.length)) {
    if (quicParseFrame(into, payload, at, toI32(payload.length)) !== n64(0) || into.end <= at) {
      return false;
    }
    if (into.type === QUIC_FRAME_ACK || into.type === QUIC_FRAME_ACK_ECN) {
      return true;
    }
    at = into.end;
  }
  return false;
};

/** The last ACK among `payloads` from `from` on, parsed into `into`; false when none carried one. */
const lastAck = (payloads: u8[][], from: i32, into: QuicFrame): boolean => {
  for (let k: i32 = toI32(payloads.length) - 1; k >= from; k--) {
    if (ackOf(payloads[k], into)) {
      return true;
    }
  }
  return false;
};

/** `count, ect0, ect1, ce` of an ACK frame, as text, `type` first. */
const countsText = (f: QuicFrame): string => `${f.type}: ${f.ect0} ${f.ect1} ${f.ce}`;

/** Two 1-RTT PINGs from the client, each in a datagram that arrived with `ecn`, which the server acknowledges. */
const pings = (p: NqPair, ecn: i32): u8[] => {
  const ping: u8[] = [toU8(QUIC_FRAME_PING)];
  p.conn.arrivalEcn = ecn;
  nqSend(p, ping);
  const last: u8[] = qcShort(p.c, ping);
  qcExchange(p.conn, p.c, last);
  return last;
};

/** The frame writer: ACK_ECN is the ACK's bytes, type 0x03, and the three counts after them. */
const frameEcn = (t: Suite): void => {
  const ranges: i64[] = [n64(9), n64(12), n64(3), n64(5)];
  const out: u8[] = [];
  t.ok("an ACK_ECN of two ranges is appended", quicPushAckEcn(out, ranges, n32(2), n64(7), n64(4), n64(1), n64(300)));
  t.eqI32("its size is what quicAckEcnSize says", toI32(out.length), quicAckEcnSize(ranges, n32(2), n64(7), n64(4), n64(1), n64(300)));
  const f = new QuicFrame();
  t.ok("and it parses as one frame, the whole of it", quicParseFrame(f, out, n32(0), toI32(out.length)) === n64(0) && f.end === toI32(out.length));
  t.eqStr("type 0x03 with ECT(0), ECT(1) and CE as written", countsText(f), "3: 4 1 300");
  t.ok("the ranges are the ACK's", f.largest === n64(12) && f.ackRangeCount === n32(2));
  t.eqI32("a negative count is refused", quicAckEcnSize(ranges, n32(2), n64(0), n64(-1), n64(0), n64(0)), n32(0));
  const small: u8[] = new Array<u8>(toI32(out.length) - 1);
  t.eqI32("a buffer a byte short takes nothing", quicPutAckEcn(small, n32(0), toI32(small.length), ranges, n32(2), n64(7), n64(4), n64(1), n64(300)), n32(-1));
  t.ok("and is left untouched", small[0] === toU8(0));
};

/** One space's counts: each codepoint to its own, Not-ECT to none, and ACK_ECN only once one is above zero. */
const rangesEcn = (t: Suite): void => {
  const r = new QuicAckRanges();
  r.record(n64(0), true);
  r.countEcn(n32(0));
  const plain: u8[] = [];
  r.pushAck(plain, n64(0));
  const f = new QuicFrame();
  t.ok("Not-ECT counts nothing, and the ACK stays type 0x02", ackOf(plain, f) && f.type === QUIC_FRAME_ACK);
  r.record(n64(1), true);
  r.countEcn(ECT0);
  r.record(n64(2), true);
  r.countEcn(ECT0 + n32(4));
  r.record(n64(3), true);
  r.countEcn(ECT1);
  r.record(n64(4), true);
  r.countEcn(CE);
  const marked: u8[] = [];
  r.pushAck(marked, n64(0));
  t.ok("each codepoint to its own count, the bits above the two ignored", ackOf(marked, f) && countsText(f) === "3: 2 1 1");
  const buf: u8[] = new Array<u8>(64);
  const end: i32 = r.putAck(buf, n32(0), n32(64), n64(0));
  t.ok("putAck writes the same ACK_ECN", end > 0 && ackOf(buf, f) && countsText(f) === "3: 2 1 1" && f.end === end);
  r.clear();
  r.record(n64(0), true);
  const after: u8[] = [];
  r.pushAck(after, n64(0));
  t.ok("clear forgets the counts with the ranges: a plain ACK again", ackOf(after, f) && f.type === QUIC_FRAME_ACK && r.ect0 === n64(0) && r.ce === n64(0));
};

/**
 * The server's ACKs echo what arrived (RFC 9000 §13.4.1): per space, counted
 * once per packet processed, a duplicate not at all.
 */
const echoed = (t: Suite): void => {
  const limits = new NqLimits();
  const conn = new QuicConnection(nqConfig(limits), fixedEntropy());
  conn.arrivalEcn = ECT0;
  const c: QcClient = nqConnect(conn, limits);
  const p = new NqPair(conn, c);
  const f = new QuicFrame();
  t.ok(
    "the client's Initial arrived ECT(0): the server's Initial ACK is an ACK_ECN counting it",
    toI32(c.longPayloads.length) > 0 && ackOf(c.longPayloads[0], f) && countsText(f) === "3: 1 0 0"
  );
  let from: i32 = toI32(c.appPayloads.length);
  pings(p, CE);
  t.ok(
    "two 1-RTT packets that arrived CE: Application Data's own counts, without the Initial's ECT(0)",
    lastAck(c.appPayloads, from, f) && countsText(f) === "3: 0 0 2"
  );
  from = toI32(c.appPayloads.length);
  const again: u8[] = pings(p, ECT1);
  p.conn.arrivalEcn = CE;
  p.conn.receiveWindow(again, n32(0), toI32(again.length), c.now);
  p.conn.receiveWindow(again, n32(0), toI32(again.length), c.now);
  pings(p, ECT1);
  t.ok(
    "a packet delivered again, CE, is a duplicate and counts nothing; two more ECT(1) count two",
    lastAck(c.appPayloads, from, f) && countsText(f) === "3: 0 4 2"
  );
};

/** A carrier that reports no ECN bits leaves `arrivalEcn` 0, and every ACK is a plain one. */
const notEct = (t: Suite): void => {
  const p: NqPair = nqPair(new NqLimits());
  const from: i32 = toI32(p.c.appPayloads.length);
  pings(p, n32(0));
  const f = new QuicFrame();
  t.ok("Not-ECT arrivals: the server's ACK is type 0x02", lastAck(p.c.appPayloads, from, f) && f.type === QUIC_FRAME_ACK);
  t.ok("and so was its Initial ACK", ackOf(p.c.longPayloads[0], f) && f.type === QUIC_FRAME_ACK);
};

export const quicEcnChecks = (): i32 => {
  const t = new Suite("quic ecn flights");
  testingEnds(t);
  unmarked(t);
  frameEcn(t);
  rangesEcn(t);
  echoed(t);
  notEct(t);
  return t.done();
};

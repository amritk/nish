// Path MTU discovery (RFC 9000 §14.3, RFC 8899) and the variable datagram
// size it gives recovery (RFC 9002 §7.2): the windows scale with the size
// and a lost probe is no congestion; inside the connection a probe of
// 1452 bytes is acknowledged and validates the path, three lost probes of
// a size narrow the search below it, three loss events of large packets
// fall back to 1200 and drop a queued DATAGRAM that no longer fits, and
// the carrier's limit and the client's max_udp_payload_size bound the
// search; a lost probe is passed over by persistent congestion, an
// acknowledged one breaks its run, a lowered limit clamps the path and
// any probe acknowledged after it, and a DATAGRAM too large for now is
// moved behind the rest.
import { Suite } from "nish/testing";
import { QUIC_RECOVERY_APPLICATION, QuicRecovery } from "nish/net/quic-recovery";
import { QUIC_DATAGRAM_OK } from "nish/net/quic";
import { QuicDatagramQueue } from "nish/net/quic-datagram";
import { bytesOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { qcDrain, qcReceive } from "../net_quic_conn/client";
import { qcStream } from "../net_quic_conn/data";
import { NqLimits, NqPair, nqAck, nqPair, nqSend, nqText } from "../net_quic_stream/common";
import { rcRange } from "./unit";

const APP: i32 = QUIC_RECOVERY_APPLICATION;

/** The windows at a datagram size of 1452, and back to 1200 (RFC 9002 §7.2). */
const pmWindowChecks = (t: Suite): void => {
  const r = new QuicRecovery();
  r.handshakeConfirmed = true;
  r.setDatagramSize(n64(1452));
  t.eqI64("at 1452 bytes the initial window is ten datagrams: 14520, under the 14720 cap", r.initialWindow(), n64(14520));
  t.eqI64("a window still at the initial one becomes it", r.congestionWindow, n64(14520));
  t.eqI64("and the minimum window is two datagrams: 2904", r.minimumWindow(), n64(2904));
  r.setDatagramSize(n64(1000));
  t.eqI64("a size under 1200 is taken as 1200", r.datagramSize, n64(1200));
  t.eqI64("and the untouched window falls back to 12000", r.congestionWindow, n64(12000));
};

/** A lost path MTU probe takes no congestion event; the same loss of a packet that is not one does (RFC 9000 §14.4). */
const pmProbeLossChecks = (t: Suite): void => {
  const probe = new QuicRecovery();
  probe.handshakeConfirmed = true;
  probe.onProbeSent(APP, probe.onPacketSent(APP, n64(0), n32(1452), n64(0)));
  for (let pn: i64 = 1; pn <= 3; pn++) {
    probe.onPacketSent(APP, pn, n32(1200), n64(0));
  }
  probe.onAck(APP, rcRange(n64(1), n64(3)), n32(1), n64(0), n64(100));
  t.eqI32("the probe is lost by packet threshold", probe.spaces[APP].lostCount, n32(1));
  t.eqI32("but no congestion event follows", probe.congestionEvents, n32(0));
  t.eqI64("and the slow start threshold is not cut", probe.ssthresh > n64(12000) ? n64(1) : n64(0), n64(1));
  t.eqI64("nor the window", probe.congestionWindow, n64(12000));

  const plain = new QuicRecovery();
  plain.handshakeConfirmed = true;
  plain.onPacketSent(APP, n64(0), n32(1452), n64(0));
  for (let pn: i64 = 1; pn <= 3; pn++) {
    plain.onPacketSent(APP, pn, n32(1200), n64(0));
  }
  plain.onAck(APP, rcRange(n64(1), n64(3)), n32(1), n64(0), n64(100));
  t.eqI32("the same loss of a packet that is no probe is a congestion event", plain.congestionEvents, n32(1));
};

/**
 * Packets 0 to 6 of 1200 bytes, sent as the persistent congestion check in
 * unit.ts sends them, with packet 2 a path MTU probe; 0 is acknowledged at
 * 10 ms for an RTT sample, then `count` pairs of `ranges` at 220 ms.
 */
const pmSpan = (ranges: i64[], count: i32): QuicRecovery => {
  const r = new QuicRecovery();
  r.handshakeConfirmed = true;
  r.onPacketSent(APP, n64(0), n32(1200), n64(0));
  r.onAck(APP, rcRange(n64(0), n64(0)), n32(1), n64(0), n64(10));
  const times: i64[] = [n64(20), n64(100), n64(200), n64(205), n64(206), n64(207)];
  for (let k: i32 = 0; k < 6; k++) {
    const slot: i32 = r.onPacketSent(APP, toI64(k + 1), n32(1200), times[k]);
    if (k === 1) {
      r.onProbeSent(APP, slot);
    }
  }
  r.onAck(APP, ranges, count, n64(0), n64(220));
  return r;
};

/** Persistent congestion (RFC 9002 §7.6.2) with a probe inside the span: a lost one is passed over, an acknowledged one breaks the run. */
const pmPersistentChecks = (t: Suite): void => {
  const lost = pmSpan(rcRange(n64(6), n64(6)), n32(1));
  t.eqI32("an ACK of 6 loses 1 to 5, the probe 2 among them", lost.spaces[APP].lostCount, n32(5));
  t.eqI32("the lost probe is passed over: 1, 3, 4 and 5 span 186 ms, persistent congestion", lost.persistentCongestions, n32(1));

  const acked = pmSpan([n64(6), n64(6), n64(2), n64(2)], n32(2));
  t.eqI32("an ACK of 6 and the probe 2 loses 1, 3, 4 and 5", acked.spaces[APP].lostCount, n32(4));
  t.eqI32("but the acknowledged probe breaks the run: no persistent congestion", acked.persistentCongestions, n32(0));
  t.eqI32("only the congestion event", acked.congestionEvents, n32(1));
};

/** The next datagram the server writes with room for 1500 bytes, which the client is not given. */
const pmTake = (p: NqPair): u8[] => {
  const buf: u8[] = new Array<u8>(1500);
  const n: i32 = p.conn.takeDatagramInto(buf, n32(0), p.c.now);
  const out: u8[] = [];
  for (let k: i32 = 0; k < n; k++) {
    out.push(buf[k]);
  }
  return out;
};

/** A connected pair with stream 0 open, whose server sends up to 64 KiB on it. */
const pmPair = (limits: NqLimits): NqPair => {
  limits.maxStreamData = n64(65536);
  const p: NqPair = nqPair(limits);
  nqSend(p, qcStream(n64(0), n64(0), "open", false));
  return p;
};

/** The server writes `count` bytes on stream 0. */
const pmWrite = (p: NqPair, count: i32): void => {
  p.conn.streamWrite(n64(0), bytesOf(nqText(count)), n32(0), count, false);
};

/** A probe that never arrives: three 1200-byte packets after it are acknowledged, which declares it lost. Answers its size. */
const pmLoseProbe = (p: NqPair): i32 => {
  const size: i32 = toI32(pmTake(p).length);
  pmWrite(p, n32(3000));
  qcDrain(p.conn, p.c);
  nqAck(p);
  return size;
};

/** Probes acknowledged and lost inside the connection. */
const pmSearchChecks = (t: Suite): void => {
  const p: NqPair = pmPair(new NqLimits());
  t.eqI32("before any probe the path is 1200 bytes", p.conn.pathMtu, n32(1200));
  const sizes: string[] = [];
  for (let k: i32 = 0; k < 3; k++) {
    sizes.push(`${pmLoseProbe(p)}`);
  }
  t.eqStr("with nothing else to send the server probes 1452 bytes, and again after each loss", sizes.join(" "), "1452 1452 1452");
  t.eqI32("three probes lost", p.conn.pmtuProbesLost, n32(3));
  t.eqI32("none of them a congestion event", p.conn.recovery.congestionEvents, n32(0));
  t.eqI32("nor a loss event toward a black hole", p.conn.pmtuBlackHoles, n32(0));
  t.eqI32("the path stays at 1200", p.conn.pathMtu, n32(1200));
  const half: u8[] = pmTake(p);
  t.eqI32("the search goes on halfway below: 1326", toI32(half.length), n32(1326));
  qcReceive(p.c, half);
  nqAck(p);
  t.eqI32("acknowledged, it validates 1326", p.conn.pathMtu, n32(1326));
  t.eqI64("and recovery counts datagrams of that size", p.conn.recovery.datagramSize, n64(1326));
  t.eqI32("then tries halfway up: 1389", toI32(pmTake(p).length), n32(1389));

  const room: NqPair = pmPair(new NqLimits());
  const held: u8[] = new Array<u8>(1500);
  t.eqI32("room for 1200 bytes holds no 1452-byte probe", room.conn.takeDatagramWithin(held, n32(0), n32(1200), room.c.now), n32(0));
  t.eqI32("room under 1200 bytes answers 0", room.conn.takeDatagramWithin(held, n32(0), n32(1199), room.c.now), n32(0));
  t.eqI32("room past the buffer's end answers 0", room.conn.takeDatagramWithin(held, n32(400), n32(1200), room.c.now), n32(0));
  t.eqI32("so neither sent a probe", room.conn.pmtuProbes, n32(0));
  t.eqI32("room for 1452 does", room.conn.takeDatagramWithin(held, n32(48), n32(1452), room.c.now), n32(1452));

  const quiet: NqPair = pmPair(new NqLimits());
  quiet.conn.pathMtuLimit = n32(1200);
  t.eqI32("a carrier limit of 1200 sends no probe", toI32(pmTake(quiet).length), n32(0));
  t.eqI32("and counts none", quiet.conn.pmtuProbes, n32(0));

  const capped: NqPair = pmPair(new NqLimits());
  capped.conn.pathMtuLimit = n32(1300);
  t.eqI32("a carrier limit of 1300 holds the first probe to 1300", toI32(pmTake(capped).length), n32(1300));

  const small = new NqLimits();
  small.clientUdpPayload = n64(1280);
  t.eqI32("a client's max_udp_payload_size of 1280 holds it to 1280", toI32(pmTake(pmPair(small)).length), n32(1280));
};

/** A path that stops carrying 1452 bytes falls back to 1200 (RFC 8899 §4.3). */
const pmBlackHoleChecks = (t: Suite): void => {
  const limits = new NqLimits();
  limits.maxDatagramFrameSize = n64(100);
  limits.clientDatagram = n64(65535);
  const p: NqPair = pmPair(limits);
  qcReceive(p.c, pmTake(p));
  nqAck(p);
  t.eqI32("a validated probe makes the path 1452", p.conn.pathMtu, n32(1452));
  t.eqI32("and the search ends there", toI32(pmTake(p).length), n32(0));
  const sizes: string[] = [];
  for (let round: i32 = 0; round < 3; round++) {
    pmWrite(p, n32(1400));
    sizes.push(toI32(pmTake(p).length) > n32(1200) ? "large" : "small");
    for (let k: i32 = 0; k < 3; k++) {
      pmWrite(p, n32(10));
      qcReceive(p.c, pmTake(p));
    }
    if (round === 2) {
      const big: u8[] = bytesOf(nqText(n32(1420)));
      t.eqI32("a 1420-byte DATAGRAM is queued while the path is 1452", p.conn.sendDatagram(big, n32(0), n32(1420)), QUIC_DATAGRAM_OK);
    }
    t.eqI32(`before loss event ${round + 1} no black hole is taken`, p.conn.pmtuBlackHoles, n32(0));
    nqAck(p);
  }
  t.eqStr("three packets past 1200 bytes go out and never arrive", sizes.join(" "), "large large large");
  t.eqI32("the third loss event of one takes the path for a black hole", p.conn.pmtuBlackHoles, n32(1));
  t.eqI32("the path falls back to 1200", p.conn.pathMtu, n32(1200));
  t.eqI32("and so does every datagram", p.conn.datagramSize(), n32(1200));
  t.eqI64("and recovery's datagram size", p.conn.recovery.datagramSize, n64(1200));
  t.eqI32("the queued DATAGRAM no longer fits a packet and is dropped", p.conn.datagramsOut.dropped, n32(1));
  t.eqI32("the search starts again below 1452: 1326", toI32(pmTake(p).length), n32(1326));
};

/** A carrier that lowers `pathMtuLimit` under a validated path takes the path down with it. */
const pmClampChecks = (t: Suite): void => {
  const p: NqPair = pmPair(new NqLimits());
  qcReceive(p.c, pmTake(p));
  nqAck(p);
  t.eqI32("a validated probe makes the path 1452", p.conn.pathMtu, n32(1452));
  p.conn.setPathMtuLimit(n32(1300));
  t.eqI32("a limit lowered to 1300 holds the next datagram to 1300", p.conn.datagramSize(), n32(1300));
  t.eqI32("and the path with it", p.conn.pathMtu, n32(1300));
  t.eqI64("and recovery's datagram size", p.conn.recovery.datagramSize, n64(1300));
  pmWrite(p, n32(3000));
  t.eqI32("a full datagram is then 1300 bytes", toI32(pmTake(p).length), n32(1300));
  p.conn.setPathMtuLimit(n32(1000));
  t.eqI32("a limit under 1200 takes the path to 1200, no lower", p.conn.datagramSize(), n32(1200));

  const late: NqPair = pmPair(new NqLimits());
  const probe: u8[] = pmTake(late);
  t.eqI32("a 1452-byte probe goes out", toI32(probe.length), n32(1452));
  late.conn.setPathMtuLimit(n32(1300));
  t.eqI32("a limit lowered while it flies leaves a 1200 path as it is", late.conn.pathMtu, n32(1200));
  qcReceive(late.c, probe);
  nqAck(late);
  t.eqI32("acknowledged after, the probe raises the path only to the limit", late.conn.pathMtu, n32(1300));
  t.eqI64("and recovery's datagram size with it", late.conn.recovery.datagramSize, n64(1300));
};

/** A DATAGRAM too large for now is moved behind the rest, not dropped, when it may fit later. */
const pmDeferChecks = (t: Suite): void => {
  const q = new QuicDatagramQueue(n32(4), n32(8));
  const bytes: u8[] = bytesOf("abcdefgh");
  q.push(bytes, n32(0), n32(8));
  q.push(bytes, n32(0), n32(2));
  q.push(bytes, n32(0), n32(3));
  q.deferOldest();
  const out: u8[] = new Array<u8>(8);
  const order: string[] = [];
  for (let k: i32 = 0; k < 3; k++) {
    order.push(`${q.pop(out, n32(0), n32(8))}`);
  }
  t.eqStr("the oldest goes behind the others", order.join(" "), "2 3 8");
  t.eqI32("and is not counted as dropped", q.dropped, n32(0));
  for (let k: i32 = 0; k < 4; k++) {
    q.push(bytes, n32(0), n32(k + 1));
  }
  q.deferOldest();
  t.eqI32("in a full ring the oldest becomes the newest", q.peekLength(), n32(2));
  const full: string[] = [];
  for (let k: i32 = 0; k < 4; k++) {
    full.push(`${q.pop(out, n32(0), n32(8))}`);
  }
  t.eqStr("and the rest keep their order", full.join(" "), "2 3 4 1");
  q.push(bytes, n32(0), n32(5));
  q.deferOldest();
  t.eqI32("a ring of one is left as it is", q.peekLength(), n32(5));
};

/** Every path MTU check. */
export const recoveryPmtuChecks = (t: Suite): void => {
  pmWindowChecks(t);
  pmProbeLossChecks(t);
  pmPersistentChecks(t);
  pmSearchChecks(t);
  pmBlackHoleChecks(t);
  pmClampChecks(t);
  pmDeferChecks(t);
};

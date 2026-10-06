// `nish/net/quic-recovery` on its own, with no connection: every figure is
// worked by hand from RFC 9002's Appendix A (the RTT estimate, loss
// detection, the probe timeout) and Appendix B (NewReno), in the module's
// integer milliseconds, and written beside the check that pins it.
import { Suite } from "nish/testing";
import { QUIC_MAX_VARINT } from "nish/net/quic-packet";
import {
  QUIC_RECOVERY_APPLICATION,
  QUIC_RECOVERY_HANDSHAKE,
  QUIC_RECOVERY_HANDSHAKE_CAPACITY,
  QUIC_RECOVERY_INITIAL,
  QUIC_RECOVERY_INITIAL_WINDOW,
  QUIC_RECOVERY_MAX_BACKOFF,
  QUIC_RECOVERY_MINIMUM_WINDOW,
  QUIC_RECOVERY_TIMEOUT_LOSS,
  QUIC_RECOVERY_TIMEOUT_NONE,
  QUIC_RECOVERY_TIMEOUT_PTO,
  QuicRecovery,
  QuicSentPackets,
} from "nish/net/quic-recovery";
import { n32, n64 } from "../net_quic_frame/typed";

const APP: i32 = QUIC_RECOVERY_APPLICATION;
const FULL: i32 = 1200;

/** One ACK range, `[low, high]`, as `QuicFrame.ackRanges` holds it. */
export const rcRange = (low: i64, high: i64): i64[] => [low, high];

/** Two ACK ranges, the higher first. */
const rcRanges = (low1: i64, high1: i64, low2: i64, high2: i64): i64[] => [low1, high1, low2, high2];

/** A recovery whose handshake is confirmed, with the default max_ack_delay of 25 ms. */
const rcConfirmed = (): QuicRecovery => {
  const r = new QuicRecovery();
  r.handshakeConfirmed = true;
  return r;
};

/** The Application Data space's packets. */
const rcApp = (r: QuicRecovery): QuicSentPackets => r.spaces[APP];

/** Sends packets `from` to `to` of the Application Data space, full-sized, all at `now`. */
const rcSend = (r: QuicRecovery, from: i64, to: i64, now: i64): void => {
  for (let pn: i64 = from; pn <= to; pn++) {
    r.onPacketSent(APP, pn, FULL, now);
  }
};

/** The packet numbers in a space's `lost` list, in order, as `0 1 2`. */
const rcLost = (sp: QuicSentPackets): string => {
  const out: string[] = [];
  for (let k: i32 = 0; k < sp.lostCount; k++) {
    out.push(`${sp.pnAt(sp.lostSlot(k))}`);
  }
  return out.join(" ");
};

/** The estimate as `latest smoothed rttvar min`. */
const rcRtt = (r: QuicRecovery): string => `${r.latestRtt} ${r.smoothedRtt} ${r.rttVar} ${r.minRtt}`;

/** Before any sample, and the RTT estimate sample by sample (§5, A.7). */
const rcRttChecks = (t: Suite): void => {
  const r = rcConfirmed();
  t.eqStr("before a sample: smoothed_rtt is kInitialRtt, 333 ms, and rttvar half of it (§6.2.2)", rcRtt(r), "0 333 166 0");
  t.eqI64("the window starts at kInitialWindow, 12000 bytes (§7.2)", r.congestionWindow, QUIC_RECOVERY_INITIAL_WINDOW);
  t.eqI64("ssthresh starts unbounded", r.ssthresh, QUIC_MAX_VARINT);
  t.eqI64("nothing in flight: no timer", r.deadline(false), n64(-1));

  t.eqI32("a packet is recorded in slot 0", r.onPacketSent(APP, n64(0), FULL, n64(0)), n32(0));
  t.eqI64("which puts 1200 bytes in flight", r.bytesInFlight(), n64(1200));
  t.eqI32("an ACK of it at 100 ms acknowledges one packet", r.onAck(APP, rcRange(n64(0), n64(0)), n32(1), n64(10), n64(100)), n32(1));
  t.eqStr("the first sample sets min_rtt and smoothed_rtt to it and rttvar to half, ignoring the ACK delay", rcRtt(r), "100 100 50 100");
  t.eqI64("and empties the flight", r.bytesInFlight(), n64(0));

  r.onPacketSent(APP, n64(1), FULL, n64(100));
  r.onAck(APP, rcRange(n64(0), n64(1)), n32(1), n64(10), n64(260));
  // adjusted = 160 - 10 = 150; rttvar = (3 × 50 + |100 - 150|) / 4 = 50; smoothed = (7 × 100 + 150) / 8 = 106.
  t.eqStr("a 160 ms sample with a 10 ms ACK delay: adjusted 150, rttvar 50, smoothed 106", rcRtt(r), "160 106 50 100");

  r.onPacketSent(APP, n64(2), FULL, n64(260));
  r.onAck(APP, rcRange(n64(0), n64(2)), n32(1), n64(50), n64(340));
  // min_rtt = 80; the delay is capped at max_ack_delay, 25, and 80 < 80 + 25 keeps
  // the sample whole: rttvar = (150 + 26) / 4 = 44; smoothed = (742 + 80) / 8 = 102.
  t.eqStr("an 80 ms sample lowers min_rtt, and a delay that would take it below min_rtt is not taken off", rcRtt(r), "80 102 44 80");
  t.eqI64("the probe timeout: 102 + 4 × 44 + max_ack_delay 25 = 303 ms (§6.2.1)", r.probeTimeout(), n64(303));
  t.eqI64("the loss delay: 9/8 of max(80, 102) = 114 ms (§6.1.2)", r.lossDelay(), n64(114));
  t.eqI64("acknowledgements while the window sat mostly idle do not grow it (§7.8)", r.congestionWindow, QUIC_RECOVERY_INITIAL_WINDOW);

  const early = new QuicRecovery();
  early.onPacketSent(APP, n64(0), FULL, n64(0));
  early.onAck(APP, rcRange(n64(0), n64(0)), n32(1), n64(0), n64(100));
  early.onPacketSent(APP, n64(1), FULL, n64(100));
  early.onAck(APP, rcRange(n64(1), n64(1)), n32(1), n64(60), n64(300));
  // Not confirmed: the 60 ms delay is not capped at 25. adjusted 140; rttvar (150 + 40) / 4 = 47; smoothed (700 + 140) / 8 = 105.
  t.eqStr("before the handshake is confirmed the ACK delay is not capped at max_ack_delay", rcRtt(early), "200 105 47 100");
  t.eqI64("and the probe timeout has no max_ack_delay in it: 105 + 188", early.probeTimeout(), n64(293));

  const initial = rcConfirmed();
  initial.onPacketSent(QUIC_RECOVERY_INITIAL, n64(0), FULL, n64(0));
  initial.onAck(QUIC_RECOVERY_INITIAL, rcRange(n64(0), n64(0)), n32(1), n64(0), n64(100));
  initial.onPacketSent(QUIC_RECOVERY_INITIAL, n64(1), FULL, n64(100));
  initial.onAck(QUIC_RECOVERY_INITIAL, rcRange(n64(1), n64(1)), n32(1), n64(60), n64(300));
  // The Initial space's delay is ignored: adjusted 200; rttvar (150 + 100) / 4 = 62; smoothed (700 + 200) / 8 = 112.
  t.eqStr("an Initial ACK's delay is ignored (§5.3)", rcRtt(initial), "200 112 62 100");

  const ackOnly = rcConfirmed();
  ackOnly.onPacketSent(APP, n64(0), FULL, n64(0));
  t.eqI32("an ACK whose largest is a packet never recorded (an ACK-only one) still acknowledges the rest", ackOnly.onAck(APP, rcRange(n64(0), n64(1)), n32(1), n64(0), n64(50)), n32(1));
  t.eqStr("but takes no RTT sample (§5.1)", rcRtt(ackOnly), "0 333 166 0");
  t.eqI64("and moves the largest acknowledged to it", rcApp(ackOnly).largestAcked, n64(1));
};

/** Loss by packet threshold and by time threshold, and reordering that is neither (§6.1, A.10). */
const rcLossChecks = (t: Suite): void => {
  const r = rcConfirmed();
  rcSend(r, n64(0), n64(3), n64(100));
  r.onPacketSent(APP, n64(4), FULL, n64(101));
  t.eqI32("five packets in flight", rcApp(r).inFlight, n32(5));
  r.onAck(APP, rcRange(n64(4), n64(4)), n32(1), n64(0), n64(150));
  // latest 49 → smoothed 49, rttvar 24; loss delay 9 × 49 / 8 = 55, so nothing sent at 100 is lost by time yet.
  t.eqStr("an ACK of 4 alone loses 0 and 1, three or more below it (kPacketThreshold)", rcLost(rcApp(r)), "0 1");
  t.eqI64("2 and 3 are not lost yet: loss_time is their send time plus the loss delay, 100 + 55", rcApp(r).lossTime, n64(155));
  t.eqI64("and it is the timer", r.deadline(false), n64(155));
  t.eqI32("one congestion event", r.congestionEvents, n32(1));
  t.eqI64("halves the window: ssthresh 6000 (B.6)", r.ssthresh, n64(6000));
  t.eqI64("the window is ssthresh", r.congestionWindow, n64(6000));
  t.eqI64("recovery started at the ACK", r.recoveryStart, n64(150));
  t.eqI64("what is still in flight is 2 and 3", r.bytesInFlight(), n64(2400));
  t.eqI32("a millisecond early the timer does nothing", r.onTimeout(n64(154), false), QUIC_RECOVERY_TIMEOUT_NONE);
  t.eqI32("at loss_time it declares the rest lost by time", r.onTimeout(n64(155), false), QUIC_RECOVERY_TIMEOUT_LOSS);
  t.eqStr("2 and 3, in the Application Data space", `${r.timeoutSpace} ${rcLost(rcApp(r))}`, `${APP} 2 3`);
  t.eqI32("sent before recovery started, they are no second congestion event (§7.3.2)", r.congestionEvents, n32(1));
  t.eqI32("and packets sent before the first RTT sample are no persistent congestion (§7.6.2)", r.persistentCongestions, n32(0));
  t.eqI64("nothing is left in flight", r.bytesInFlight(), n64(0));

  const reordered = rcConfirmed();
  reordered.onPacketSent(APP, n64(0), FULL, n64(0));
  reordered.onPacketSent(APP, n64(1), FULL, n64(1));
  reordered.onAck(APP, rcRange(n64(1), n64(1)), n32(1), n64(0), n64(50));
  t.eqStr("an ACK of 1 before 0 loses nothing: 0 is only one below", rcLost(rcApp(reordered)), "");
  t.eqI64("but sets loss_time, 0 + 9/8 × 49", reordered.deadline(false), n64(55));
  t.eqI32("the ACK of 0 that the network delayed arrives first", reordered.onAck(APP, rcRanges(n64(0), n64(1), n64(0), n64(0)), n32(2), n64(0), n64(52)), n32(1));
  t.ok("so there is no loss, no congestion event and no timer", reordered.congestionEvents === n32(0) && reordered.deadline(false) === n64(-1));
  t.eqI32("an ACK of what was acknowledged already acknowledges nothing", reordered.onAck(APP, rcRange(n64(0), n64(1)), n32(1), n64(0), n64(60)), n32(0));
};

/** The probe timeout, its backoff and the spaces it covers (§6.2, A.8, A.9). */
const rcPtoChecks = (t: Suite): void => {
  const r = rcConfirmed();
  r.onPacketSent(APP, n64(0), FULL, n64(1000));
  // No sample: 333 + 4 × 166 = 997, plus max_ack_delay 25 for Application Data.
  t.eqI64("one packet in flight at 1000 ms: the probe timeout is 1000 + 997 + 25", r.deadline(false), n64(2022));
  t.eqI32("a millisecond early nothing fires", r.onTimeout(n64(2021), false), QUIC_RECOVERY_TIMEOUT_NONE);
  t.eqI32("at it the probe timeout fires", r.onTimeout(n64(2022), false), QUIC_RECOVERY_TIMEOUT_PTO);
  t.eqStr("in the Application Data space, with pto_count 1", `${r.timeoutSpace} ${r.ptoCount}`, `${APP} 1`);
  t.eqI64("the next one is twice as far from the packet: 1000 + 2 × 1022", r.deadline(false), n64(3044));
  r.onTimeout(n64(3044), false);
  t.eqI64("and then four times", r.deadline(false), n64(5088));
  t.eqI64("a probe timeout declares nothing lost", r.bytesInFlight(), n64(1200));
  for (let k: i32 = 0; k < 20; k++) {
    r.onTimeout(r.deadline(false), false);
  }
  t.eqI32("the backoff stops at QUIC_RECOVERY_MAX_BACKOFF doublings", r.ptoCount, QUIC_RECOVERY_MAX_BACKOFF);
  t.eqI64("so the deadline stays in range: 1000 + 1022 × 2^16", r.deadline(false), n64(1000) + n64(1022) * n64(65536));
  r.onAck(APP, rcRange(n64(0), n64(0)), n32(1), n64(0), n64(6000));
  t.eqI32("an ACK resets the backoff", r.ptoCount, n32(0));

  const unconfirmed = new QuicRecovery();
  unconfirmed.onPacketSent(APP, n64(0), FULL, n64(0));
  t.eqI64("before the handshake is confirmed, Application Data has no probe timeout (A.8)", unconfirmed.deadline(false), n64(-1));
  unconfirmed.onPacketSent(QUIC_RECOVERY_HANDSHAKE, n64(0), FULL, n64(10));
  t.eqI64("a Handshake packet has one, without max_ack_delay: 10 + 997", unconfirmed.deadline(false), n64(1007));
  t.eqI64("an amplification-blocked server has none (§6.2.2.1)", unconfirmed.deadline(true), n64(-1));
  t.eqI32("so its timer fires nothing", unconfirmed.onTimeout(n64(5000), true), QUIC_RECOVERY_TIMEOUT_NONE);
  unconfirmed.onPacketSent(QUIC_RECOVERY_INITIAL, n64(0), FULL, n64(5));
  t.eqI64("the earliest space wins: the Initial packet sent at 5 ms", unconfirmed.deadline(false), n64(1002));
  unconfirmed.onTimeout(n64(1002), false);
  t.eqStr("and the probe goes in the Initial space", `${unconfirmed.timeoutSpace} ${unconfirmed.ptoCount}`, `${QUIC_RECOVERY_INITIAL} 1`);
  unconfirmed.discardSpace(QUIC_RECOVERY_INITIAL);
  t.ok("discarding a space takes its packets out of flight and resets the backoff (A.11)", unconfirmed.bytesInFlight() === n64(2400) && unconfirmed.ptoCount === n32(0));
  unconfirmed.discardSpace(QUIC_RECOVERY_HANDSHAKE);
  t.eqI64("with only Application Data in flight before confirmation, no timer is left", unconfirmed.deadline(false), n64(-1));
};

/** NewReno: slow start, recovery, congestion avoidance, the minimum window and persistent congestion (§7, B). */
const rcCongestionChecks = (t: Suite): void => {
  const r = rcConfirmed();
  rcSend(r, n64(0), n64(9), n64(0));
  t.ok("ten full datagrams fill the initial window", r.bytesInFlight() === n64(12000) && !r.canSend());
  r.onAck(APP, rcRange(n64(0), n64(9)), n32(1), n64(0), n64(100));
  t.eqI64("slow start: each acknowledged byte adds one to the window (B.5)", r.congestionWindow, n64(24000));
  t.ok("and there is room again", r.canSend());

  rcSend(r, n64(10), n64(29), n64(200));
  r.onAck(APP, rcRange(n64(13), n64(29)), n32(1), n64(0), n64(300));
  t.eqStr("an ACK of 13 to 29 loses 10, 11 and 12: the threshold counts from the largest acknowledged, 29", rcLost(rcApp(r)), "10 11 12");
  t.ok("ssthresh and the window become half of 24000", r.ssthresh === n64(12000) && r.congestionWindow === n64(12000));
  t.eqI64("packets sent before the recovery period started do not grow the window", r.congestionWindow, n64(12000));

  rcSend(r, n64(30), n64(34), n64(310));
  r.onAck(APP, rcRange(n64(30), n64(34)), n32(1), n64(0), n64(400));
  t.ok("nothing more is lost, and there is no second congestion event", rcLost(rcApp(r)) === "" && r.congestionEvents === n32(1));
  // 12000 + 120 = 12120, + 118 = 12238, + 117 = 12355, + 116 = 12471, + 115 = 12586.
  t.eqI64("30 to 34, sent in recovery's wake, grow it by 1200 × 1200 / window each (B.5)", r.congestionWindow, n64(12586));

  const small = rcConfirmed();
  small.congestionWindow = n64(3000);
  rcSend(small, n64(0), n64(3), n64(0));
  small.onAck(APP, rcRange(n64(3), n64(3)), n32(1), n64(0), n64(10));
  t.ok("halving 3000 stops at kMinimumWindow, 2400 bytes", small.ssthresh === n64(1500) && small.congestionWindow === QUIC_RECOVERY_MINIMUM_WINDOW);

  const p = rcConfirmed();
  p.onPacketSent(APP, n64(0), FULL, n64(0));
  p.onAck(APP, rcRange(n64(0), n64(0)), n32(1), n64(0), n64(10));
  p.onPacketSent(APP, n64(1), FULL, n64(20));
  p.onPacketSent(APP, n64(2), FULL, n64(100));
  p.onPacketSent(APP, n64(3), FULL, n64(200));
  p.onPacketSent(APP, n64(4), FULL, n64(205));
  p.onPacketSent(APP, n64(5), FULL, n64(206));
  p.onPacketSent(APP, n64(6), FULL, n64(207));
  p.onAck(APP, rcRange(n64(6), n64(6)), n32(1), n64(0), n64(220));
  // smoothed (70 + 13) / 8 = 10, rttvar (15 + 3) / 4 = 4: the span is (10 + 16 + 25) × 3 = 153 ms,
  // and 1 to 5 were lost over 20 to 206 ms, with nothing acknowledged between.
  t.eqStr("an ACK of 6 loses 1 to 5, by packet and by time threshold", rcLost(rcApp(p)), "1 2 3 4 5");
  t.eqI32("spanning 186 ms, past three probe timeouts: persistent congestion (§7.6)", p.persistentCongestions, n32(1));
  t.eqI64("which ends the recovery period", p.recoveryStart, n64(-1));
  // B.8 collapses the window to kMinimumWindow, then B.5 grows it by packet 6, acknowledged outside any recovery period.
  t.eqI64("and collapses the window to the minimum, from which the ACK's own packet grows it in slow start", p.congestionWindow, QUIC_RECOVERY_MINIMUM_WINDOW + n64(1200));

  const q = rcConfirmed();
  q.onPacketSent(APP, n64(0), FULL, n64(0));
  q.onAck(APP, rcRange(n64(0), n64(0)), n32(1), n64(0), n64(10));
  q.onPacketSent(APP, n64(1), FULL, n64(20));
  q.onPacketSent(APP, n64(2), FULL, n64(100));
  q.onAck(APP, rcRange(n64(2), n64(2)), n32(1), n64(0), n64(150));
  q.onPacketSent(APP, n64(3), FULL, n64(200));
  q.onPacketSent(APP, n64(4), FULL, n64(205));
  q.onPacketSent(APP, n64(5), FULL, n64(206));
  q.onPacketSent(APP, n64(6), FULL, n64(207));
  q.onAck(APP, rcRange(n64(6), n64(6)), n32(1), n64(0), n64(220));
  t.eqI32("the same losses with 2 acknowledged between them are no persistent congestion", q.persistentCongestions, n32(0));
};

/** The pacer (§7.7): a burst of the initial window, then 5/4 of the window per smoothed RTT. */
const rcPacerChecks = (t: Suite): void => {
  const r = new QuicRecovery();
  t.eqI64("a full datagram may go at once", r.pacerDelay(n64(0), FULL), n64(0));
  for (let k: i32 = 0; k < 10; k++) {
    r.onPaced(n64(0), FULL);
  }
  // 1200 bytes at 5/4 × 12000 bytes per 333 ms: 1200 × 333 × 4 / 60000 = 26.6, rounded up.
  t.eqI64("after a burst of the initial window the next waits 27 ms", r.pacerDelay(n64(0), FULL), n64(27));
  t.eqI64("27 ms later it may go", r.pacerDelay(n64(27), FULL), n64(0));
  r.pacerDelay(n64(100000), FULL);
  t.eqI64("a long idle refills the budget only up to the initial window", r.pacerBudget, QUIC_RECOVERY_INITIAL_WINDOW);
  r.onPaced(n64(100000), FULL);
  t.eqI64("time handed in backwards earns nothing", r.pacerDelay(n64(50), FULL), n64(0));
  t.eqI64("and restarts the pacer's clock there", r.pacerTime, n64(50));
};

/** Everything `nish/net/quic-recovery` refuses, and its full ring. */
const rcRefusalChecks = (t: Suite): void => {
  const r = rcConfirmed();
  t.eqI32("a space index below 0 records nothing", r.onPacketSent(n32(-1), n64(0), FULL, n64(0)), n32(-1));
  t.eqI32("nor one past Application Data", r.onPacketSent(n32(3), n64(0), FULL, n64(0)), n32(-1));
  t.eqI32("nor a packet of no bytes", r.onPacketSent(APP, n64(0), n32(0), n64(0)), n32(-1));
  t.eqI32("nor a packet number past 2^62 - 1", r.onPacketSent(APP, QUIC_MAX_VARINT + n64(1), FULL, n64(0)), n32(-1));
  r.onPacketSent(APP, n64(5), FULL, n64(0));
  t.eqI32("nor a packet number not above the last one recorded", r.onPacketSent(APP, n64(5), FULL, n64(0)), n32(-1));
  t.eqI32("an ACK for no space is refused", r.onAck(n32(3), rcRange(n64(5), n64(5)), n32(1), n64(0), n64(1)), n32(-1));
  t.eqI32("so is an ACK with no range", r.onAck(APP, rcRange(n64(5), n64(5)), n32(0), n64(0), n64(1)), n32(-1));
  const none: i64[] = [];
  t.eqI32("and one whose ranges are not there", r.onAck(APP, none, n32(1), n64(0), n64(1)), n32(-1));
  t.eqI32("a range count past the array reads only what is there", r.onAck(APP, rcRange(n64(5), n64(5)), n32(9), n64(0), n64(1)), n32(1));
  t.ok("there is no space 3", r.space(n32(3)) === null);
  t.ok("results past the count are -1", rcApp(r).ackedSlot(n32(1)) === n32(-1) && rcApp(r).lostSlot(n32(0)) === n32(-1));
  t.eqI32("nothing in flight: nothing to evict", r.evictOldest(APP), n32(-1));
  t.eqI32("and no space 9 to evict from", r.evictOldest(n32(9)), n32(-1));
  r.discardSpace(n32(9));

  const ring = new QuicRecovery();
  let recorded: i32 = 0;
  for (let pn: i64 = 0; pn < toI64(QUIC_RECOVERY_HANDSHAKE_CAPACITY); pn++) {
    recorded = recorded + (ring.onPacketSent(QUIC_RECOVERY_INITIAL, pn, FULL, n64(0)) >= 0 ? 1 : 0);
  }
  t.eqI32("the Initial space keeps 16 packets in flight", recorded, QUIC_RECOVERY_HANDSHAKE_CAPACITY);
  const initial: QuicSentPackets = ring.spaces[QUIC_RECOVERY_INITIAL];
  t.ok("and is then full", initial.full());
  t.eqI32("so a 17th is refused", ring.onPacketSent(QUIC_RECOVERY_INITIAL, n64(16), FULL, n64(0)), n32(-1));
  ring.onAck(QUIC_RECOVERY_INITIAL, rcRange(n64(0), n64(0)), n32(1), n64(0), n64(1));
  t.ok("an ACK of the oldest frees its slot for the next", ring.onPacketSent(QUIC_RECOVERY_INITIAL, n64(16), FULL, n64(2)) >= n32(0));
  const events: i32 = ring.congestionEvents;
  const evicted: i32 = ring.evictOldest(QUIC_RECOVERY_INITIAL);
  t.eqI64("evicting gives up the oldest still in flight, packet 1", initial.pnAt(evicted), n64(1));
  t.ok("out of flight, with no congestion event", initial.inFlight === n32(15) && ring.congestionEvents === events);
};

/** Every check of the module on its own. */
export const recoveryUnitChecks = (t: Suite): void => {
  rcRttChecks(t);
  rcLossChecks(t);
  rcPtoChecks(t);
  rcCongestionChecks(t);
  rcPacerChecks(t);
  rcRefusalChecks(t);
};

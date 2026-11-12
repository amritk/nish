// CUBIC (RFC 9438) in `nish/net/quic-recovery`, beside the NewReno checks
// of `unit.ts`, and the configuration field that picks it. Every window is
// in bytes with 1200-byte datagrams, every time in milliseconds. The curve
// is W(t) = W_max + C·(t − K)³ with C = 0.4 datagrams/s³, which in these
// units is W_max + 2 × 1200 × (t − K)³ / 5 × 10⁹ bytes, and
// K = ∛((W_max − cwnd) × 5 × 10⁹ / 2400) ms.
//
// The windows pinned below come from `cubic_model.py` beside this file, a
// separate integer model of RFC 9438 §4 (the same units and truncations,
// written apart from the module); `python3 cubic_model.py` prints each
// figure again. It drives the same synthetic ACK clock: each round, at one
// instant, acknowledges every packet of the round before one ACK at a time
// and sends one in its place, so 100 full datagrams (120000 bytes) are
// always in flight and every RTT sample is exactly the round's length.
// The figures the comments work by hand are the ones the RFC fixes exactly.
import { Suite } from "nish/testing";
import {
  QUIC_RECOVERY_APPLICATION,
  QUIC_RECOVERY_CUBIC,
  QUIC_RECOVERY_MINIMUM_WINDOW,
  QUIC_RECOVERY_NEWRENO,
  QuicRecovery,
  quicRecoveryCbrt,
} from "nish/net/quic-recovery";
import { QUIC_ERROR_INTERNAL, QUIC_STATE_CLOSING, QuicConnection, QuicServerConfig } from "nish/net/quic";
import { n32, n64 } from "../net_quic_frame/typed";
import { qcDefaultConfig } from "../net_quic_conn/common";
import { fixedEntropy } from "../net_quic_conn_replay/server";

const APP: i32 = QUIC_RECOVERY_APPLICATION;
const FULL: i32 = 1200;

/** The synthetic ACK clock: the packets of the last round are `oldest .. oldest + count - 1`, and `next` is the next to send. */
class RcClock {
  next: i64 = 4;
  oldest: i64 = 4;
  count: i32 = 0;
}

/**
 * One round at `now`: each packet of the round before is acknowledged on its
 * own, and after each of the first `n` of those ACKs a packet is sent; when
 * `n` is larger than the round before, the rest go after the last ACK.
 */
const rcRound = (r: QuicRecovery, c: RcClock, now: i64, n: i32): void => {
  for (let i: i32 = 0; i < c.count; i++) {
    r.onAck(APP, [c.oldest, c.oldest], n32(1), n64(0), now);
    c.oldest = c.oldest + n64(1);
    if (i < n) {
      r.onPacketSent(APP, c.next, FULL, now);
      c.next = c.next + n64(1);
    }
  }
  for (let i: i32 = c.count; i < n; i++) {
    r.onPacketSent(APP, c.next, FULL, now);
    c.next = c.next + n64(1);
  }
  c.count = n;
};

/**
 * A confirmed CUBIC recovery at a 200000-byte window that has just lost a
 * packet: 0 to 3 go at 0, the ACK of 1 to 3 at `rtt` loses 0 by the packet
 * threshold and takes the first sample, `rtt`. `wmax` is the W_max of an
 * earlier loss, or 0.
 */
const rcCubicLoss = (rtt: i64, wmax: i64): QuicRecovery => {
  const r = new QuicRecovery();
  r.handshakeConfirmed = true;
  r.controller = QUIC_RECOVERY_CUBIC;
  r.congestionWindow = n64(200000);
  r.cubicMax = wmax;
  for (let pn: i64 = 0; pn < 4; pn++) {
    r.onPacketSent(APP, pn, FULL, n64(0));
  }
  r.onAck(APP, [n64(1), n64(3)], n32(1), n64(0), rtt);
  return r;
};

/** The cube root, and the decrease on a loss (§4.6, §4.7). */
const rcCubicLossChecks = (t: Suite): void => {
  t.eqI64("∛0 is 0", quicRecoveryCbrt(n64(0)), n64(0));
  t.eqI64("5000³ is 1.25 × 10¹¹, so its cube root is 5000", quicRecoveryCbrt(n64(125000000000)), n64(5000));
  t.eqI64("and one below it rounds down to 4999", quicRecoveryCbrt(n64(124999999999)), n64(4999));
  t.eqI64("40000³, 6.4 × 10¹³, has root 40000", quicRecoveryCbrt(n64(64000000000000)), n64(40000));
  t.eqI64("and past it the root stops there: 40000 ms", quicRecoveryCbrt(n64(1000000000000000)), n64(40000));

  const r = rcCubicLoss(n64(100), n64(0));
  t.eqI32("one congestion event", r.congestionEvents, n32(1));
  // β = 0.7: 200000 × 7 / 10.
  t.ok("multiplicative decrease by β = 0.7: ssthresh and the window 140000, not NewReno's 100000", r.ssthresh === n64(140000) && r.congestionWindow === n64(140000));
  t.eqI64("W_max is the window before the loss", r.cubicMax, n64(200000));
  t.eqI64("and cwnd_prior with it", r.cubicPrior, n64(200000));
  t.eqI64("the epoch starts at the first acknowledgement after recovery, not at the loss", r.cubicEpoch, n64(-1));

  const f = rcCubicLoss(n64(100), n64(250000));
  // 200000 is below the last W_max, 250000: W_max = 200000 × (1 + β) / 2 = 170000.
  t.eqI64("fast convergence: a loss below the last W_max remembers 0.85 of the window", f.cubicMax, n64(170000));
  t.eqI64("the decrease itself is still 0.7", f.congestionWindow, n64(140000));
  const c = new RcClock();
  rcRound(f, c, n64(101), n32(100));
  rcRound(f, c, n64(201), n32(100));
  // K = ∛(30000 × 5 × 10⁹ / 2400) = ∛(6.25 × 10¹⁰) = 3968.5, truncated: 3968³ = 62476255232 ≤ 6.25 × 10¹⁰ < 3969³ = 62523502209.
  t.eqI64("so K, the time back to W_max, is 3968 ms, where 200000 would have taken 5000", f.cubicK, n64(3968));
};

/**
 * At a 100 ms RTT, from 140000 after a loss at 200000: K is 5000 ms, and
 * the window climbs a concave curve that flattens at W_max around K, then
 * a convex one past it. W(t) is computed at t + RTT, so the window trails
 * the curve by a little; the Reno estimate stays far below it.
 */
const rcCubicCurveChecks = (t: Suite): void => {
  const r = rcCubicLoss(n64(100), n64(0));
  const c = new RcClock();
  // Sent after the loss at 100, so outside the recovery period.
  rcRound(r, c, n64(101), n32(100));
  const at: i64[] = [];
  const text: string[] = [];
  const est: string[] = [];
  for (let j: i32 = 1; j <= 71; j++) {
    rcRound(r, c, n64(101) + n64(100) * toI64(j), n32(100));
    if ((j - 1) % 10 === 0) {
      at.push(r.congestionWindow);
      text.push(`${r.congestionWindow}`);
      est.push(`${r.cubicEst}`);
    }
  }
  // (200000 − 140000) × 5 × 10⁹ / 2400 = 1.25 × 10¹¹ = 5000³.
  t.eqI64("K = ∛((W_max − cwnd) / C) = 5000 ms exactly", r.cubicK, n64(5000));
  t.eqI64("the epoch is the first ACK after recovery, at 201", r.cubicEpoch, n64(201));
  t.eqStr(
    "the window at t = 0 to 7 s",
    text.join(" "),
    "140543 169319 186828 195985 199447 199995 200483 203779"
  );
  // Growth per second: 28776, 17509, 9157, 3462, 548, then 488 and 3296 past
  // K. The window trails W(t + RTT) by under an RTT of growth, so the second
  // just past K, where the curve is flattest, adds the least.
  t.ok("concave below W_max: each second adds less than the one before", at[1] - at[0] > at[2] - at[1] && at[2] - at[1] > at[3] - at[2] && at[3] - at[2] > at[4] - at[3] && at[4] - at[3] > at[5] - at[4]);
  t.ok("at K the window has reached W_max to within 0.1%, and holds below it", at[5] < n64(200000) && at[5] > n64(199800));
  t.ok("convex past K: from 6 to 7 s the window gains more than from 5 to 6 s", at[7] - at[6] > at[6] - at[5] && at[6] > n64(200000));
  t.eqStr("the Reno estimate W_est, far below: 9/17 of a datagram a window of ACKs", est.slice(0, 7).join(" "), "140543 145435 149699 153669 157518 161333 165142");
};

/**
 * At a 10 ms RTT, the same loss: Reno's window grows ten times as often as
 * at 100 ms, while the curve still runs on the clock, so W_est is above W(t)
 * and the window follows it — the Reno-friendly region (§4.3).
 */
const rcCubicFriendlyChecks = (t: Suite): void => {
  const r = rcCubicLoss(n64(10), n64(0));
  const c = new RcClock();
  rcRound(r, c, n64(11), n32(100));
  const at: string[] = [];
  let follows: boolean = true;
  for (let j: i32 = 1; j <= 101; j++) {
    rcRound(r, c, n64(11) + n64(10) * toI64(j), n32(100));
    follows = follows && r.congestionWindow === r.cubicEst;
    if ((j - 1) % 50 === 0) {
      at.push(`${r.congestionWindow}`);
    }
  }
  t.ok("every round the window is W_est", follows);
  // W(1000) = 200000 + 2400 × (1000 − 5000)³ / (5 × 10⁹) = 200000 − 30720 = 169280.
  t.eqStr("the window at t = 0, 0.5 and 1 s: past W(1 s) = 169280, and the 169319 a 100 ms RTT reaches", at.join(" "), "140543 165457 187082");
  // On until W_est reaches cwnd_prior, 200000: from there α is 1 (§4.3), a
  // datagram a window of ACKs where it was 9/17 of one.
  let now: i64 = n64(1021);
  while (r.cubicEst < r.cubicPrior) {
    now = now + n64(10);
    rcRound(r, c, now, n32(100));
  }
  t.ok("W_est reaches cwnd_prior in the round at 1351, which ends at 200146", now === n64(1351) && r.congestionWindow === n64(200146));
  const before: i64 = r.congestionWindow;
  rcRound(r, c, now + n64(10), n32(100));
  // 100 × 1200 × 1200 / 200146 = 719.5, less what the carries hold back.
  t.eqI64("past it a round adds 718 bytes, where 9/17 of a datagram a window would add 381", r.congestionWindow - before, n64(718));
};

/**
 * Application-limited (§4.2, §5.8 of RFC 9002): an ACK while less than half
 * the window is in flight grows nothing, and the idle time is taken out of
 * the epoch, so the curve does not jump ahead when sending resumes.
 */
const rcCubicIdleChecks = (t: Suite): void => {
  const r = rcCubicLoss(n64(100), n64(0));
  const c = new RcClock();
  rcRound(r, c, n64(101), n32(100));
  for (let j: i32 = 1; j <= 10; j++) {
    rcRound(r, c, n64(101) + n64(100) * toI64(j), n32(100));
  }
  t.eqI64("ten rounds in, at 1101", r.congestionWindow, n64(167012));
  // The first round of one packet: the first ACKs still find more than half of 167012 in flight.
  rcRound(r, c, n64(1201), n32(1));
  t.eqI64("draining the flight grows the window while it is still half full", r.congestionWindow, n64(167940));
  t.eqI64("the ACK that finds less than half in flight starts the idle time", r.cubicIdle, n64(1201));
  let held: boolean = true;
  for (let j: i32 = 12; j <= 21; j++) {
    rcRound(r, c, n64(101) + n64(100) * toI64(j), n32(j === 21 ? 100 : 1));
    held = held && r.congestionWindow === n64(167940);
  }
  t.ok("the rounds of one packet in flight, to 2201, leave the window where it was", held);
  t.eqI64("the epoch has not moved yet", r.cubicEpoch, n64(201));
  rcRound(r, c, n64(2301), n32(100));
  // Idle from 1201 to 2301: the epoch moves 1100 ms, from 201 to 1301.
  t.eqI64("the first ACK of a full flight again moves the epoch by the idle time", r.cubicEpoch, n64(1301));
  t.eqI64("and growth resumes from t = 1000", r.congestionWindow, n64(169768));
};

/**
 * The target is W(t + RTT) but at most 1.5 × cwnd (§4.4): at a 10 s RTT,
 * W(20 s) = 200000 + 2400 × 15000³ / (5 × 10⁹) = 1820000, far past it, so a
 * round grows the window by half, 600 bytes an ACK, not 9000.
 */
const rcCubicCeilingChecks = (t: Suite): void => {
  const r = rcCubicLoss(n64(10000), n64(0));
  const c = new RcClock();
  rcRound(r, c, n64(10001), n32(100));
  rcRound(r, c, n64(20001), n32(100));
  t.eqI64("at t = 0 the window is W_est, as at the shorter RTTs", r.congestionWindow, n64(140543));
  rcRound(r, c, n64(30001), n32(100));
  t.eqI64("at t = 10 s the curve's 1820000 is held to 1.5 × cwnd: 100 ACKs of 600 bytes, less truncation", r.congestionWindow, n64(200542));
};

/**
 * At a 10⁸-byte window, 68718 bytes short of W(t + RTT), an ACK of 1200
 * bytes moves the window 68718 × 1200 / 10⁸ = 0.82 of a byte. Truncated each
 * time, that would never grow; the carry adds the fractions up.
 */
const rcCubicLargeChecks = (t: Suite): void => {
  const r = new QuicRecovery();
  r.handshakeConfirmed = true;
  r.controller = QUIC_RECOVERY_CUBIC;
  r.congestionWindow = n64(100000000);
  r.ssthresh = n64(70000000);
  r.cubicMax = n64(105000000);
  r.cubicPrior = n64(105000000);
  // 127 datagrams and one large packet, the record's 128: the large one,
  // never acknowledged, keeps more than half the window in flight.
  for (let pn: i64 = 0; pn < 127; pn++) {
    r.onPacketSent(APP, pn, FULL, n64(0));
  }
  r.onPacketSent(APP, n64(127), n32(60000000), n64(0));
  for (let pn: i64 = 0; pn < 127; pn++) {
    r.onAck(APP, [pn, pn], n32(1), n64(0), n64(100));
  }
  // K = ∛(5 × 10⁶ × 5 × 10⁹ / 2400) = ∛(1.04 × 10¹³), 21839.
  t.eqI64("K for a fall of 5 × 10⁶ bytes is 21839 ms", r.cubicK, n64(21839));
  t.eqI64("127 ACKs of 0.82 byte each grow a 10⁸-byte window by 104, not 0", r.congestionWindow, n64(100000104));
};

/** Persistent congestion (§4.8 of RFC 9438, §7.6 of RFC 9002) collapses CUBIC to the minimum window as it does NewReno. */
const rcCubicPersistentChecks = (t: Suite): void => {
  const p = new QuicRecovery();
  p.handshakeConfirmed = true;
  p.controller = QUIC_RECOVERY_CUBIC;
  p.onPacketSent(APP, n64(0), FULL, n64(0));
  p.onAck(APP, [n64(0), n64(0)], n32(1), n64(0), n64(10));
  p.onPacketSent(APP, n64(1), FULL, n64(20));
  p.onPacketSent(APP, n64(2), FULL, n64(100));
  p.onPacketSent(APP, n64(3), FULL, n64(200));
  p.onPacketSent(APP, n64(4), FULL, n64(205));
  p.onPacketSent(APP, n64(5), FULL, n64(206));
  p.onPacketSent(APP, n64(6), FULL, n64(207));
  p.onAck(APP, [n64(6), n64(6)], n32(1), n64(0), n64(220));
  t.eqI32("the losses of `unit.ts`'s persistent-congestion case are persistent congestion under CUBIC too", p.persistentCongestions, n32(1));
  // ssthresh 12000 × 0.7 = 8400; the window collapses to 2400, and packet 6 grows it by 1200 in slow start.
  t.ok("ssthresh is 0.7 of the window, and the window the minimum plus the ACK's own packet", p.ssthresh === n64(8400) && p.congestionWindow === QUIC_RECOVERY_MINIMUM_WINDOW + n64(1200));
  t.eqI64("and the next stage of congestion avoidance starts a new epoch", p.cubicEpoch, n64(-1));
};

/** `QuicServerConfig.congestion` picks the controller; any other value does not fit. */
const rcCubicConfigChecks = (t: Suite): void => {
  const reno: QuicServerConfig = qcDefaultConfig();
  t.eqI32("congestion 0 is NewReno", new QuicConnection(reno, fixedEntropy()).recovery.controller, QUIC_RECOVERY_NEWRENO);
  const cubic: QuicServerConfig = qcDefaultConfig();
  cubic.congestion = QUIC_RECOVERY_CUBIC;
  const conn = new QuicConnection(cubic, fixedEntropy());
  t.ok("congestion QUIC_RECOVERY_CUBIC runs CUBIC, and fits", conn.recovery.controller === QUIC_RECOVERY_CUBIC && conn.state !== QUIC_STATE_CLOSING);
  let refused: boolean = true;
  for (const value of [n32(2), n32(-1)]) {
    const bad: QuicServerConfig = qcDefaultConfig();
    bad.congestion = value;
    const closed = new QuicConnection(bad, fixedEntropy());
    refused = refused && closed.state === QUIC_STATE_CLOSING && closed.error === QUIC_ERROR_INTERNAL;
  }
  t.ok("an unknown controller, 2 or -1, does not fit: the connection closes with INTERNAL_ERROR", refused);
};

/** Every CUBIC check. */
export const recoveryCubicChecks = (t: Suite): void => {
  rcCubicLossChecks(t);
  rcCubicCurveChecks(t);
  rcCubicFriendlyChecks(t);
  rcCubicIdleChecks(t);
  rcCubicCeilingChecks(t);
  rcCubicLargeChecks(t);
  rcCubicPersistentChecks(t);
  rcCubicConfigChecks(t);
};

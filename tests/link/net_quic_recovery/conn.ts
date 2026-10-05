// Loss recovery inside `nish/net/quic`, driven sans-IO by the test client of
// `net_quic_conn`: a handshake flight lost whole, stream data lost by packet
// and by time threshold, reordering that is not loss, a black hole the probe
// timeout backs off from until the idle timeout ends it, the frames that are
// and are not sent again, the window holding data back while an ACK still
// goes, a full record of packets in flight, and the listener's pacer.
import { Secret, secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";
import {
  QUIC_FRAME_HANDSHAKE_DONE,
  QUIC_FRAME_NEW_CONNECTION_ID,
  QUIC_FRAME_PATH_CHALLENGE,
  QUIC_FRAME_PING,
  QUIC_FRAME_RETIRE_CONNECTION_ID,
  QUIC_FRAME_STREAM,
  QuicFrame,
  quicParseFrame,
  quicPushAck,
  quicPushNewConnectionId,
  quicPushPathData,
  quicPushStreamError,
  quicPushValue,
} from "nish/net/quic-frame";
import { QUIC_RECOVERY_APPLICATION_CAPACITY } from "nish/net/quic-recovery";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QUIC_STATE_CONNECTED, QUIC_STATE_TIMED_OUT, QuicConnection } from "nish/net/quic";
import { quicListenerPaceTime, quicListenerTakePaced } from "nish/net/quic-listener";
import { tlsSignEcdsaP256 } from "nish/net/tls";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { bytesOf, fromHex, textOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPrivate } from "../net_tls_common/server";
import {
  CLIENT_SCID,
  QC_T0,
  QcClient,
  qcCrypto,
  qcDrain,
  qcExchange,
  qcFinishedPacket,
  qcHello,
  qcInitial,
  qcParams,
  qcReadFlight,
  qcReceive,
  qcShort,
} from "../net_quic_conn/client";
import { QcFound, qcConnected, qcData, qcDefaultConfig, qcFind, qcServer } from "../net_quic_conn/common";
import { qcStream } from "../net_quic_conn/data";

/** An ACK frame from the client for `[low, high]`, with an ACK Delay field of `delay` (scaled by the default exponent, 3). */
const rcAck = (low: i64, high: i64, delay: i64): u8[] => {
  const out: u8[] = [];
  const ranges: i64[] = [low, high];
  quicPushAck(out, ranges, n32(1), delay);
  return out;
};

/** An ACK frame for `[low1, high1]` and the lower `[low2, high2]`, which leaves the packets between them out. */
const rcAckTwo = (low1: i64, high1: i64, low2: i64, high2: i64): u8[] => {
  const out: u8[] = [];
  const ranges: i64[] = [low1, high1, low2, high2];
  quicPushAck(out, ranges, n32(2), n64(0));
  return out;
};

/** Hands the server one datagram and answers what it sends back, dropped: the network lost it. */
const rcLose = (conn: QuicConnection, now: i64): i32 => {
  let n: i32 = 0;
  let out: u8[] | null = conn.takeDatagram(now);
  while (out !== null) {
    n++;
    out = conn.takeDatagram(now);
  }
  return n;
};

/** Signs for the server when its handshake asks, as a carrier would. */
const rcSign = (conn: QuicConnection): void => {
  const input: u8[] | null = conn.signatureInput();
  if (input !== null) {
    const key: Secret<u8[]> = secret(leafPrivate());
    const signature: u8[] | null = tlsSignEcdsaP256(key, input);
    wipe(key);
    if (signature !== null) {
      conn.sign(signature);
    }
  }
};

/** How many frames of `type` a payload carries. */
const rcCount = (payload: u8[], type: i32): i32 => {
  const frame = new QuicFrame();
  let n: i32 = 0;
  let at: i32 = 0;
  while (at < toI32(payload.length)) {
    if (quicParseFrame(frame, payload, at, toI32(payload.length)) !== n64(0) || frame.end <= at) {
      return n;
    }
    if (frame.type === type) {
      n++;
    }
    at = frame.end;
  }
  return n;
};

/** The client's last 1-RTT payload from the server, or an empty one. */
const rcLastPayload = (c: QcClient): u8[] => {
  const k: i32 = toI32(c.appPayloads.length) - 1;
  if (k >= 0 && k < toI32(c.appPayloads.length)) {
    return c.appPayloads[k];
  }
  const none: u8[] = [];
  return none;
};

/** A connected pair whose client opened stream 0 and acknowledged everything the server sent. */
const rcOpened = (conn: QuicConnection): QcClient => {
  const c: QcClient = qcConnected(conn, n64(65536));
  qcExchange(conn, c, qcShort(c, qcStream(n64(0), n64(0), "open", false)));
  qcExchange(conn, c, qcShort(c, rcAck(n64(0), c.largestApp, n64(0))));
  return c;
};

/** Writes `text` on stream 0 and sends it in one datagram the client reads. Answers its packet number. */
const rcWrite = (conn: QuicConnection, c: QcClient, text: string): i64 => {
  conn.writeStream(n64(0), bytesOf(text), false);
  const out: u8[] | null = conn.takeDatagram(c.now);
  if (out !== null) {
    qcReceive(c, out);
  }
  return c.largestApp;
};

/** A STREAM frame of `payload`, as `offset text`, or `none`. */
const rcStreamIn = (payload: u8[]): string => {
  const payloads: u8[][] = [payload];
  const f: QcFound = qcFind(payloads, QUIC_FRAME_STREAM);
  return f.found ? `${f.frame.offset} ${textOf(qcData(f))}` : "none";
};

/** The server's first flight lost whole, and the probe timeout sending it again (RFC 9002 §6.2.4). */
const rcLostFlight = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const scid: u8[] = fromHex(CLIENT_SCID);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536))));
  c.before = hello;
  conn.receive(qcInitial(c, qcCrypto(n64(0), hello), n32(1200)), c.now);
  rcSign(conn);
  t.ok("the server's first flight goes out, and the network loses it", rcLose(conn, c.now) >= n32(1));
  t.eqI64("with no RTT sample, its probe timeout is 333 + 4 × 166 ms after it", conn.deadline(), QC_T0 + n64(997));
  t.ok("there is room under the amplification limit for a probe", !conn.amplificationBlocked());
  c.now = conn.deadline();
  const from: i32 = toI32(c.datagrams.length);
  conn.handleTimer(c.now);
  t.eqI32("at it the probe timeout fires", conn.recovery.ptoCount, n32(1));
  t.ok("and a probe goes out", qcDrain(conn, c) >= n32(1));
  t.ok("its Initial carries the ServerHello again, from offset 0", qcReadFlight(c, from, n32(0)));
  qcExchange(conn, c, qcInitial(c, rcAck(n64(0), c.largestInitial, n64(0)), n32(1200)));
  qcReadFlight(c, from, n32(0));
  qcExchange(conn, c, qcFinishedPacket(c));
  t.eqI32("the client completes the handshake from what was sent again", conn.state, QUIC_STATE_CONNECTED);
  t.eqI64("its ACK of the probe gave the first RTT sample, 0 ms on this clock", conn.recovery.firstSampleTime, c.now);
  t.eqI32("and reset the backoff", conn.recovery.ptoCount, n32(0));
};

/** Stream data lost by the packet threshold, sent again from what the stream kept (§6.1.1). */
const rcPacketThreshold = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = rcOpened(conn);
  const first: i64 = rcWrite(conn, c, "chunk0");
  rcWrite(conn, c, "chunk1");
  rcWrite(conn, c, "chunk2");
  const last: i64 = rcWrite(conn, c, "chunk3");
  t.eqI64("four chunks go in four packets", last - first, n64(3));
  qcExchange(conn, c, qcShort(c, rcAckTwo(first + n64(1), last, n64(0), first - n64(1))));
  t.eqI32("an ACK of the last three loses the first, three below the largest", conn.recovery.congestionEvents, n32(1));
  qcDrain(conn, c);
  t.eqStr("the next packet carries its bytes again, at their offset", rcStreamIn(rcLastPayload(c)), "0 chunk0");
  const stream = conn.findStream(n64(0));
  t.ok("the stream keeps its sent bytes while a packet in flight carries them", stream !== null && toI32(stream.send.length) === n32(24));
  qcExchange(conn, c, qcShort(c, rcAck(n64(0), c.largestApp, n64(0))));
  t.ok("once every one is acknowledged it lets them go", stream !== null && toI32(stream.send.length) === n32(0) && stream.sendBase === n64(24));
};

/** Reordering inside the time threshold is not loss; past it, it is (§6.1.2). */
const rcTimeThreshold = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = rcOpened(conn);
  const a: i64 = rcWrite(conn, c, "early");
  const b: i64 = rcWrite(conn, c, "later");
  c.now = c.now + n64(40);
  qcExchange(conn, c, qcShort(c, rcAck(b, b, n64(0))));
  // latest_rtt 40 ms, so the loss delay is 9/8 × 40 = 45 ms from when `a` was sent.
  t.eqI64("an ACK of the later packet alone sets a loss timer 45 ms after the earlier was sent", conn.deadline(), QC_T0 + n64(45));
  t.eqStr("RTT: latest 40, smoothed 40, rttvar 20", `${conn.recovery.latestRtt} ${conn.recovery.smoothedRtt} ${conn.recovery.rttVar}`, "40 40 20");
  conn.handleTimer(QC_T0 + n64(45));
  t.eqI32("at it the earlier packet is lost", conn.recovery.congestionEvents, n32(1));
  c.now = QC_T0 + n64(45);
  qcDrain(conn, c);
  t.eqStr("and its bytes go again", rcStreamIn(rcLastPayload(c)), "0 early");

  const calm: QuicConnection = qcServer(qcDefaultConfig());
  const d: QcClient = rcOpened(calm);
  const x: i64 = rcWrite(calm, d, "one");
  const y: i64 = rcWrite(calm, d, "two");
  d.now = d.now + n64(40);
  qcExchange(calm, d, qcShort(d, rcAck(y, y, n64(0))));
  d.now = d.now + n64(2);
  qcExchange(calm, d, qcShort(d, rcAck(x, x, n64(0))));
  t.ok("the earlier packet's ACK arriving inside the loss delay is reordering, not loss", calm.recovery.congestionEvents === n32(0) && rcLose(calm, d.now) === n32(0));
};

/** The RTT estimate from the client's ACK delays, as RFC 9002 §5.3 adjusts it. */
const rcRttFromAcks = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = rcOpened(conn);
  const first: i64 = rcWrite(conn, c, "x");
  c.now = QC_T0 + n64(40);
  qcExchange(conn, c, qcShort(c, rcAck(n64(0), first, n64(80))));
  const second: i64 = rcWrite(conn, c, "y");
  c.now = QC_T0 + n64(100);
  // An ACK Delay field of 1250, at the default exponent 3, is 10000 µs: 10 ms.
  qcExchange(conn, c, qcShort(c, rcAck(n64(0), second, n64(1250))));
  // latest 60, adjusted 50; rttvar (3 × 20 + 10) / 4 = 17; smoothed (7 × 40 + 50) / 8 = 41.
  t.eqStr(
    "two samples: latest 60, smoothed 41, rttvar 17, min 40",
    `${conn.recovery.latestRtt} ${conn.recovery.smoothedRtt} ${conn.recovery.rttVar} ${conn.recovery.minRtt}`,
    "60 41 17 40"
  );
  t.eqI64("the probe timeout is 41 + 4 × 17 + the client's max_ack_delay of 25", conn.recovery.probeTimeout(), n64(134));
  t.eqI64("the client's max_ack_delay came from its transport parameters", conn.recovery.maxAckDelay, conn.peerParameters.maxAckDelay);

  const third: i64 = rcWrite(conn, c, "z");
  c.now = QC_T0 + n64(200);
  // A field of 2^61 cannot be scaled: it is held at 2^40 µs, and then at max_ack_delay, 25 ms.
  qcExchange(conn, c, qcShort(c, rcAck(n64(0), third, n64(1073741824) * n64(2147483648))));
  // latest 100, adjusted 75; rttvar (51 + 34) / 4 = 21; smoothed (287 + 75) / 8 = 45.
  t.eqStr("an ACK Delay too large to scale counts as max_ack_delay", `${conn.recovery.smoothedRtt} ${conn.recovery.rttVar}`, "45 21");
  conn.peerParameters.ackDelayExponent = n64(99);
  const fourth: i64 = rcWrite(conn, c, "w");
  c.now = QC_T0 + n64(300);
  qcExchange(conn, c, qcShort(c, rcAck(n64(0), fourth, n64(8000))));
  // An exponent past 20 is read as the default 3: 64 ms, held at 25. latest 100, adjusted 75;
  // rttvar (63 + 30) / 4 = 23; smoothed (315 + 75) / 8 = 48.
  t.eqStr("an ack_delay_exponent past 20 is read as the default, 3", `${conn.recovery.smoothedRtt} ${conn.recovery.rttVar}`, "48 23");
};

/** A peer that acknowledges nothing: probes back off, carry everything again, and the idle timeout ends it. */
const rcBlackHole = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = qcConnected(conn, n64(65536));
  qcExchange(conn, c, qcShort(c, qcStream(n64(0), n64(0), "open", false)));
  const void3k: string[] = [];
  for (let k: i32 = 0; k < 200; k++) {
    void3k.push("into the void ");
  }
  conn.writeStream(n64(0), bytesOf(void3k.join("")), false);
  rcLose(conn, c.now);
  // Nothing acknowledged: 997 ms, plus max_ack_delay once confirmed.
  const t1: i64 = conn.deadline();
  t.eqI64("the probe timeout is 1022 ms after the last ack-eliciting packet", t1, QC_T0 + n64(1022));
  c.now = t1;
  conn.handleTimer(t1);
  const at: i32 = toI32(c.appPayloads.length);
  qcDrain(conn, c);
  const none: u8[] = [];
  const probe: u8[] = at >= 0 && at < toI32(c.appPayloads.length) ? c.appPayloads[at] : none;
  t.eqStr("the probe carries the stream data again, from its start", rcStreamIn(probe).substring(0, 16), "0 into the void ");
  t.ok("and HANDSHAKE_DONE and the NEW_CONNECTION_IDs the lost packets carried", rcCount(probe, QUIC_FRAME_HANDSHAKE_DONE) === n32(1) && rcCount(probe, QUIC_FRAME_NEW_CONNECTION_ID) === n32(3));
  const t2: i64 = conn.deadline();
  t.eqI64("the next is twice the period after the probe", t2 - t1, n64(2044));
  conn.handleTimer(t2);
  rcLose(conn, t2);
  t.eqI64("then four times", conn.deadline() - t2, n64(4088));
  let probes: i32 = 2;
  while (conn.state === QUIC_STATE_CONNECTED && conn.deadline() >= n64(0) && probes < 32) {
    const at: i64 = conn.deadline();
    conn.handleTimer(at);
    rcLose(conn, at);
    probes++;
  }
  t.eqI32("until the idle timeout ends the connection", conn.state, QUIC_STATE_TIMED_OUT);
  t.ok("after a handful of probes: the backoff keeps a black hole cheap", probes <= n32(6));
};

/** Which frames a probe sends again, and which it does not. */
const rcResentFrames = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = rcOpened(conn);
  // The client's next ID, retiring its first: the server owes RETIRE_CONNECTION_ID 0.
  const ncid: u8[] = [];
  quicPushNewConnectionId(ncid, n64(1), n64(1), fromHex("d0d1d2d3d4d5d6d7"), fromHex("e0e1e2e3e4e5e6e7e8e9eaebecedeeef"));
  conn.receive(qcShort(c, ncid), c.now);
  rcLose(conn, c.now);
  conn.handleTimer(conn.deadline());
  qcDrain(conn, c);
  t.eqI32("a lost RETIRE_CONNECTION_ID goes again", rcCount(rcLastPayload(c), QUIC_FRAME_RETIRE_CONNECTION_ID), n32(1));
  c.now = conn.deadline();
  conn.handleTimer(c.now);
  qcDrain(conn, c);
  t.eqI32("once, even when two packets in flight carried it", rcCount(rcLastPayload(c), QUIC_FRAME_RETIRE_CONNECTION_ID), n32(1));

  const stop: QuicConnection = qcServer(qcDefaultConfig());
  const s: QcClient = rcOpened(stop);
  stop.writeStream(n64(0), bytesOf("unwanted"), false);
  rcLose(stop, s.now);
  const frame: u8[] = [];
  quicPushStreamError(frame, n64(0), n64(7), n64(-1));
  stop.receive(qcShort(s, frame), s.now);
  qcDrain(stop, s);
  s.now = stop.deadline();
  stop.handleTimer(s.now);
  qcDrain(stop, s);
  t.eqStr("after STOP_SENDING the stream's lost data is not sent again", rcStreamIn(rcLastPayload(s)), "none");
  t.eqI32("so the probe is a PING", rcCount(rcLastPayload(s), QUIC_FRAME_PING), n32(1));

  const path: QuicConnection = qcServer(qcDefaultConfig());
  const p: QcClient = rcOpened(path);
  const challenge: u8[] = [];
  quicPushPathData(challenge, QUIC_FRAME_PATH_CHALLENGE, fromHex("0102030405060708"), n32(0));
  path.receive(qcShort(p, challenge), p.now);
  rcLose(path, p.now);
  p.now = path.deadline();
  path.handleTimer(p.now);
  qcDrain(path, p);
  t.eqI32("a lost PATH_RESPONSE is not sent again (RFC 9000 §13.3): the probe is a PING", rcCount(rcLastPayload(p), QUIC_FRAME_PING), n32(1));

  const retired: QuicConnection = qcServer(qcDefaultConfig());
  const r: QcClient = qcConnected(retired, n64(65536));
  const retire: u8[] = [];
  quicPushValue(retire, QUIC_FRAME_RETIRE_CONNECTION_ID, n64(1));
  retired.receive(qcShort(r, retire), r.now);
  rcLose(retired, r.now);
  r.now = retired.deadline();
  retired.handleTimer(r.now);
  qcDrain(retired, r);
  const sequences: string[] = [];
  const f = new QuicFrame();
  const payload: u8[] = rcLastPayload(r);
  let at: i32 = 0;
  while (at < toI32(payload.length) && quicParseFrame(f, payload, at, toI32(payload.length)) === n64(0) && f.end > at) {
    if (f.type === QUIC_FRAME_NEW_CONNECTION_ID) {
      sequences.push(`${f.value}`);
    }
    at = f.end;
  }
  t.eqStr("a lost NEW_CONNECTION_ID for an ID the client retired is not sent again; its replacement is", sequences.join(" "), "2 3 4");
};

/** NewReno's window holds data back, an ACK still goes, and the window's opening lets the rest go. */
const rcWindow = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = rcOpened(conn);
  conn.recovery.congestionWindow = n64(2400);
  const text: string[] = [];
  for (let k: i32 = 0; k < 500; k++) {
    text.push("0123456789");
  }
  conn.writeStream(n64(0), bytesOf(text.join("")), false);
  const sent: i32 = qcDrain(conn, c);
  t.ok("a 2400-byte window lets two datagrams go, and holds the rest", sent === n32(2) && !conn.recovery.canSend());
  const stream = conn.findStream(n64(0));
  t.ok("which stays queued", stream !== null && toI32(stream.send.length) - stream.sendHead > n32(0));
  qcExchange(conn, c, qcShort(c, fromHex("01")));
  t.eqStr("a PING from the client is still acknowledged: an ACK is not held back", rcStreamIn(rcLastPayload(c)), "none");
  qcExchange(conn, c, qcShort(c, rcAck(n64(0), c.largestApp, n64(0))));
  t.ok("the client's ACK opens the window, and the next data goes", rcStreamIn(rcLastPayload(c)) !== "none");
};

/** A full record of packets in flight holds new data back, and a probe still gets out. */
const rcFullRecord = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = rcOpened(conn);
  let sent: i32 = 0;
  let out: u8[] | null = null;
  const z: u8[] = bytesOf("z");
  for (let k: i32 = 0; k < 300; k++) {
    conn.writeStream(n64(0), z, false);
    out = conn.takeDatagram(c.now);
    if (out === null) {
      break;
    }
    sent++;
  }
  t.eqI32("128 small packets fill the Application Data space's record", sent, QUIC_RECOVERY_APPLICATION_CAPACITY);
  t.ok("the next waits, though the window has room", out === null && conn.recovery.canSend());
  c.now = conn.deadline();
  conn.handleTimer(c.now);
  t.ok("a probe timeout gives up the oldest record for the probe, which goes out", conn.takeDatagram(c.now) !== null);
};

/** The listener's pacer: a burst of the initial window, then one datagram at a time (RFC 9002 §7.7). */
const rcPacing = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = rcOpened(conn);
  t.ok("with nothing due the pacer lets nothing out", quicListenerTakePaced(conn, c.now) === null && quicListenerPaceTime(conn, c.now) === c.now);
  conn.recovery.congestionWindow = n64(100000);
  const text: string[] = [];
  for (let k: i32 = 0; k < 2000; k++) {
    text.push("0123456789");
  }
  conn.writeStream(n64(0), bytesOf(text.join("")), false);
  let paced: i32 = 0;
  while (quicListenerTakePaced(conn, c.now) !== null && paced < 100) {
    paced++;
  }
  t.eqI32("ten full datagrams go at once: the initial window's burst", paced, n32(10));
  // The client's one ACK named an ACK-only packet as its largest, so there is no RTT
  // sample yet: 1200 bytes at 5/4 of 100000 per 333 ms is 1200 × 333 × 4 / 500000 = 3.2 ms, rounded up.
  t.eqI64("the next waits 4 ms", quicListenerPaceTime(conn, c.now), c.now + n64(4));
  t.ok("not a millisecond less", quicListenerTakePaced(conn, c.now + n64(3)) === null);
  t.ok("and then goes", quicListenerTakePaced(conn, c.now + n64(4)) !== null);
};

/** Every check of loss recovery inside the connection. */
export const recoveryConnChecks = (t: Suite): void => {
  rcLostFlight(t);
  rcPacketThreshold(t);
  rcTimeThreshold(t);
  rcRttFromAcks(t);
  rcBlackHole(t);
  rcResentFrames(t);
  rcWindow(t);
  rcFullRecord(t);
  rcPacing(t);
};

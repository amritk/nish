// The runner's `rebind-port` case, played sans-IO against the interop
// server's QUIC configuration: a bulk transfer on stream 0, one packet lost,
// and the client's NAT rebinding its port during the round trip in which the
// server resends the hole. What the server sends in that round trip decides
// the case. With a stream buffer below the path's flight, it sends the hole
// and nothing new: once the client has acknowledged it, nothing is on its
// way to the client, and a rebind then is never seen unless the server
// probes early (issue #1485), which the timed 64 KiB transfer checks. With
// the configuration's own buffer, new data keeps arriving after the rebind,
// the client acknowledges it from the new port, and the server follows (RFC
// 9000 §9.3).
import { Suite } from "nish/testing";
import {
  QUIC_FRAME_PATH_CHALLENGE,
  QUIC_FRAME_PATH_RESPONSE,
  QUIC_FRAME_STREAM,
  QuicFrame,
  quicFrameAckEliciting,
  quicParseFrame,
  quicPushPathData,
} from "nish/net/quic-frame";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QUIC_STATE_CONNECTED, QuicConnection, QuicServerConfig } from "nish/net/quic";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { fromHex, toHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafCertificate } from "../net_tls_common/server";
import { CLIENT_SCID, QcClient, qcConnect, qcExchange, qcHello, qcParams, qcPushAppAck, qcReceive, qcShort } from "../net_quic_conn/client";
import { qcStream } from "../net_quic_conn/data";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { HQ_ALPN } from "./app";
import { interopQuicConfig } from "./server";

/**
 * The runner's path in flight: 10 Mbps over its 30 ms round trip, plus its
 * 25-packet queue, about 75 KB. The case sets the server's congestion window
 * to it, so the window and not the stream buffer is what the path allows.
 */
const RB_FLIGHT: i64 = 75000;

/** One round trip on the runner's path, in milliseconds. */
const RB_RTT: i64 = 30;

/** The bytes the transfer offers: more than either buffer takes. */
const RB_SOURCE: i32 = 1048576;

/** `::ffff:10.0.0.1` port `port`, in `nish:net`'s 18-byte form. */
const rbAddr = (port: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < 18; k++) {
    out.push(toU8(0));
  }
  out[10] = toU8(255);
  out[11] = toU8(255);
  out[12] = toU8(10);
  out[15] = toU8(1);
  out[16] = toU8((port >> 8) & 255);
  out[17] = toU8(port & 255);
  return out;
};

/** A transfer under way, and what each side has seen of it. */
class Rebind {
  conn: QuicConnection;
  c: QcClient;
  source: u8[];
  written: i32 = 0;
  /** The client's address before the rebind, and after it. */
  home: u8[];
  moved: u8[];
  /** The stream offset of the lost packet's first byte, or -1 before it. */
  hole: i64 = -1;
  /** One past the highest stream byte the server has sent, and the client has received. */
  sentEnd: i64 = 0;
  gotEnd: i64 = 0;
  /** `sentEnd` once the server has answered the client's last ACK from the old port. */
  rebindEnd: i64 = 0;
  /** Datagrams sent to the old binding after the rebind, which the NAT dropped. */
  dropped: i32 = 0;
  frame: QuicFrame;

  constructor(conn: QuicConnection, c: QcClient) {
    this.conn = conn;
    this.c = c;
    this.source = new Array<u8>(RB_SOURCE);
    this.home = rbAddr(n32(4433));
    this.moved = rbAddr(n32(4434));
    this.frame = new QuicFrame();
  }
}

/** One past the highest byte of stream 0 a payload carries, and its lowest, as `[low, end]`; `[-1, -1]` for none. */
const rbSpan = (r: Rebind, payload: u8[]): i64[] => {
  let low: i64 = -1;
  let end: i64 = -1;
  let at: i32 = 0;
  while (at < toI32(payload.length)) {
    if (quicParseFrame(r.frame, payload, at, toI32(payload.length)) !== n64(0) || r.frame.end <= at) {
      break;
    }
    if (r.frame.type === QUIC_FRAME_STREAM && r.frame.streamId === n64(0) && r.frame.dataLength > 0) {
      const top: i64 = r.frame.offset + toI64(r.frame.dataLength);
      if (low < 0 || r.frame.offset < low) {
        low = r.frame.offset;
      }
      if (top > end) {
        end = top;
      }
    }
    at = r.frame.end;
  }
  const out: i64[] = [low, end];
  return out;
};

/** Opens a datagram to read it, as the network sees it, and leaves the client as if it never arrived. */
const rbPeek = (r: Rebind, datagram: u8[]): u8[] => {
  const c: QcClient = r.c;
  const ranges: i64[] = [];
  for (const v of c.appRanges) {
    ranges.push(v);
  }
  const largest: i64 = c.largestApp;
  const n: i32 = toI32(c.appPayloads.length);
  qcReceive(c, datagram);
  let payload: u8[] = [];
  if (toI32(c.appPayloads.length) > n) {
    payload = c.appPayloads[n];
  }
  while (toI32(c.appPayloads.length) > n) {
    c.appPayloads.pop();
  }
  c.appRanges = ranges;
  c.largestApp = largest;
  return payload;
};

/** Gives the server as much of the source as its stream takes. */
const rbTopUp = (r: Rebind): void => {
  const taken: i32 = r.conn.streamWrite(n64(0), r.source, r.written, toI32(r.source.length) - r.written, false);
  if (taken > 0) {
    r.written = r.written + taken;
  }
};

/** Every datagram the server sends now, in order, with `sentEnd` moved past what they carry. */
const rbSend = (r: Rebind): u8[][] => {
  rbTopUp(r);
  const out: u8[][] = [];
  let d: u8[] | null = r.conn.takeDatagram(r.c.now);
  while (d !== null) {
    const span: i64[] = rbSpan(r, rbPeek(r, d));
    if (span[1] > r.sentEnd) {
      r.sentEnd = span[1];
    }
    out.push(d);
    d = r.conn.takeDatagram(r.c.now);
  }
  return out;
};

/** The client receives a datagram. */
const rbDeliver = (r: Rebind, datagram: u8[]): void => {
  const span: i64[] = rbSpan(r, rbPeek(r, datagram));
  qcReceive(r.c, datagram);
  if (span[1] > r.gotEnd) {
    r.gotEnd = span[1];
  }
};

/** The client acknowledges what it has, from `from`. */
const rbAck = (r: Rebind, from: u8[]): void => {
  const ack: u8[] = [];
  qcPushAppAck(ack, r.c);
  const datagram: u8[] = qcShort(r.c, ack);
  r.conn.receiveWindowFrom(datagram, n32(0), toI32(datagram.length), from, r.c.now);
};

/** Sends whatever the server has now after the rebind: to the new port it arrives, to the old one the NAT drops it. Answers how many arrived. */
const rbAfter = (r: Rebind): i32 => {
  let arrived: i32 = 0;
  for (const d of rbSend(r)) {
    if (toHex(r.conn.sendAddress()) === toHex(r.moved)) {
      rbDeliver(r, d);
      arrived++;
    } else {
      r.dropped = r.dropped + 1;
    }
  }
  return arrived;
};

/**
 * Plays the case up to the rebind:
 * the handshake, a request on stream 0, one round trip of the transfer with
 * its first data packet lost, the client's ACK that reports it, and the
 * server's answer, which the client receives. Answers that answer.
 */
const rbStall = (t: Suite, r: Rebind): u8[][] => {
  const c: QcClient = r.c;
  c.address = r.home;
  const scid: u8[] = fromHex(CLIENT_SCID);
  const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], HQ_ALPN, quicEncodeTransportParameters(qcParams(scid, n64(1048576))));
  t.ok("the client connects, and the server is ready to send", qcConnect(r.conn, c, hello) && r.conn.state === QUIC_STATE_CONNECTED);
  qcExchange(r.conn, c, qcShort(c, qcStream(n64(0), n64(0), "GET /f\r\n", true)));
  rbAck(r, r.home);
  r.conn.recovery.congestionWindow = RB_FLIGHT;
  for (const d of rbSend(r)) {
    const span: i64[] = rbSpan(r, rbPeek(r, d));
    if (r.hole < 0 && span[0] >= 0) {
      r.hole = span[0];
    } else {
      rbDeliver(r, d);
    }
  }
  c.now = c.now + RB_RTT;
  rbAck(r, r.home);
  return rbSend(r);
};

/**
 * The rebind lands in the round trip of `stall`: the client acknowledges its
 * first two packets, as RFC 9000 §13.2.2 lets it, from the old port; then its
 * NAT moves it. What the server sent before the move still arrives, and the
 * client acknowledges it from the new port; what the server sends to the old
 * one after, the NAT drops. Then the server's timers run three times.
 */
const rbRebind = (r: Rebind, stall: u8[][]): void => {
  let k: i32 = 0;
  while (k < toI32(stall.length) && k < 2) {
    rbDeliver(r, stall[k]);
    k++;
  }
  rbAck(r, r.home);
  r.c.address = r.moved;
  const late: u8[][] = rbSend(r);
  r.dropped = r.dropped + toI32(late.length);
  r.rebindEnd = r.sentEnd;
  const pending: boolean = k < toI32(stall.length);
  while (k < toI32(stall.length)) {
    rbDeliver(r, stall[k]);
    k++;
  }
  if (pending) {
    rbAck(r, r.moved);
    rbAfter(r);
  }
  for (let round: i32 = 0; round < 3; round++) {
    r.c.now = r.conn.deadline() > r.c.now ? r.conn.deadline() : r.c.now + RB_RTT;
    r.conn.handleTimer(r.c.now);
    if (rbAfter(r) > 0) {
      rbAck(r, r.moved);
    }
  }
};

/** The bytes of stream 0 the timed transfer must deliver in order: four times the 64 KiB buffer. */
const RB_TARGET: i32 = 262144;

/** The timed transfer gives up here, in milliseconds after it starts: past where the client would see nothing at all. */
const RB_GIVE_UP: i64 = 5000;

/**
 * Datagrams on their way in one direction, each with the time it arrives
 * and, toward the server, the address it comes from.
 */
class RbWire {
  datagrams: u8[][];
  arrive: i64[];
  from: u8[][];
  head: i32 = 0;

  constructor() {
    this.datagrams = [];
    this.arrive = [];
    this.from = [];
  }

  push(datagram: u8[], arrive: i64, from: u8[]): void {
    this.datagrams.push(datagram);
    this.arrive.push(arrive);
    this.from.push(from);
  }

  /** When the next datagram arrives, or -1 for none. */
  next(): i64 {
    return this.head < toI32(this.datagrams.length) ? this.arrive[this.head] : n64(-1);
  }
}

/** The timed transfer: what the client has in order, and when the server followed the rebind. */
class RbTimed {
  /** The client's address now, and when its NAT moves it, or -1 until it is set. */
  address: u8[];
  rebindAt: i64 = -1;
  /** Which stream bytes below `RB_TARGET` arrived, and how many arrived in order. */
  got: u8[];
  contiguous: i32 = 0;
  /** When the server first sent to the new port, and when the last in-order byte arrived; -1 before. */
  followedAt: i64 = -1;
  doneAt: i64 = -1;
  start: i64 = 0;
  /** When the client received the hole's resend, the time the rebind is set from. */
  holeAt: i64 = -1;

  constructor(address: u8[]) {
    this.address = address;
    this.got = new Array<u8>(RB_TARGET);
  }
}

/** Marks the stream-0 bytes of `payload` as arrived, and answers the data of its PATH_CHALLENGE, or none. */
const rbTake = (r: Rebind, timed: RbTimed, payload: u8[]): u8[] => {
  let challenge: u8[] = [];
  let at: i32 = 0;
  while (at < toI32(payload.length)) {
    if (quicParseFrame(r.frame, payload, at, toI32(payload.length)) !== n64(0) || r.frame.end <= at) {
      break;
    }
    const f: QuicFrame = r.frame;
    if (f.type === QUIC_FRAME_STREAM && f.streamId === n64(0)) {
      for (let k: i32 = 0; k < f.dataLength; k++) {
        const offset: i64 = f.offset + toI64(k);
        if (offset < toI64(RB_TARGET)) {
          timed.got[toI32(offset)] = toU8(1);
        }
      }
      if (f.offset === r.hole && timed.holeAt < 0) {
        timed.holeAt = r.c.now;
      }
    } else if (f.type === QUIC_FRAME_PATH_CHALLENGE) {
      const data: u8[] = [];
      for (let k: i32 = f.dataStart; k < f.dataStart + f.dataLength; k++) {
        data.push(payload[k]);
      }
      challenge = data;
    }
    at = f.end;
  }
  while (timed.contiguous < RB_TARGET && timed.got[timed.contiguous] === toU8(1)) {
    timed.contiguous = timed.contiguous + 1;
  }
  return challenge;
};

/** Whether `payload` holds a frame that asks for an acknowledgement. */
const rbEliciting = (r: Rebind, payload: u8[]): boolean => {
  let at: i32 = 0;
  while (at < toI32(payload.length)) {
    if (quicParseFrame(r.frame, payload, at, toI32(payload.length)) !== n64(0) || r.frame.end <= at) {
      break;
    }
    if (quicFrameAckEliciting(r.frame.type)) {
      return true;
    }
    at = r.frame.end;
  }
  return false;
};

/**
 * The server sends what it has now. The NAT sits halfway along the path, so
 * a datagram sent to the client's current binding arrives one way later,
 * and one sent to the binding it left is dropped. The first datagram with
 * stream data is lost: that is the hole.
 */
const rbTimedSend = (r: Rebind, timed: RbTimed, toClient: RbWire): void => {
  for (const d of rbSend(r)) {
    if (r.hole < 0) {
      const span: i64[] = rbSpan(r, rbPeek(r, d));
      if (span[0] >= 0) {
        r.hole = span[0];
        continue;
      }
    }
    if (toHex(r.conn.sendAddress()) !== toHex(timed.address)) {
      r.dropped = r.dropped + 1;
      continue;
    }
    if (timed.followedAt < 0 && toHex(r.conn.sendAddress()) === toHex(r.moved)) {
      timed.followedAt = r.c.now;
    }
    toClient.push(d, r.c.now + RB_RTT / 2, timed.address);
  }
};

/**
 * Datagrams that arrive at the client now: it reads them and, if any asked
 * for one, acknowledges what it holds from wherever its NAT has it now,
 * with a PATH_RESPONSE to the last PATH_CHALLENGE, padded to 1200 bytes.
 */
const rbTimedClient = (r: Rebind, timed: RbTimed, toClient: RbWire, toServer: RbWire): void => {
  let eliciting: boolean = false;
  let challenge: u8[] = [];
  while (toClient.next() >= 0 && toClient.next() <= r.c.now) {
    const d: u8[] = toClient.datagrams[toClient.head];
    toClient.head = toClient.head + 1;
    const payload: u8[] = rbPeek(r, d);
    qcReceive(r.c, d);
    const asked: u8[] = rbTake(r, timed, payload);
    if (toI32(asked.length) > 0) {
      challenge = asked;
    }
    eliciting = eliciting || rbEliciting(r, payload);
  }
  if (!eliciting) {
    return;
  }
  const frames: u8[] = [];
  qcPushAppAck(frames, r.c);
  if (toI32(challenge.length) > 0) {
    quicPushPathData(frames, QUIC_FRAME_PATH_RESPONSE, challenge, n32(0));
    while (toI32(frames.length) < 1171) {
      frames.push(toU8(0));
    }
  }
  toServer.push(qcShort(r.c, frames), r.c.now + RB_RTT / 2, timed.address);
};

/**
 * The runner's case played in time, one way taking half of `RB_RTT`: the
 * request, the transfer with its first data packet lost, and the client's
 * NAT moving its port `RB_RTT / 4` after it received the hole's resend and
 * acknowledged it. That lands the rebind in the half round trip in which
 * the client has acknowledged everything and nothing is on its way to it
 * unless the server sends something. Runs until `RB_TARGET` bytes have
 * arrived in order, or `RB_GIVE_UP` passes.
 */
const rbTimedTransfer = (t: Suite, r: Rebind): RbTimed => {
  const c: QcClient = r.c;
  c.address = r.home;
  const scid: u8[] = fromHex(CLIENT_SCID);
  const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], HQ_ALPN, quicEncodeTransportParameters(qcParams(scid, n64(1048576))));
  t.ok("the timed client connects", qcConnect(r.conn, c, hello) && r.conn.state === QUIC_STATE_CONNECTED);
  const timed = new RbTimed(r.home);
  timed.start = c.now;
  r.conn.recovery.congestionWindow = RB_FLIGHT;
  const toClient = new RbWire();
  const toServer = new RbWire();
  toServer.push(qcShort(c, qcStream(n64(0), n64(0), "GET /f\r\n", true)), c.now + RB_RTT / 2, timed.address);
  for (let step: i32 = 0; step < 100000 && timed.contiguous < RB_TARGET; step++) {
    let next: i64 = toClient.next();
    const arrive: i64 = toServer.next();
    if (arrive >= 0 && (next < 0 || arrive < next)) {
      next = arrive;
    }
    const due: i64 = r.conn.deadline();
    if (due >= 0 && (next < 0 || due < next)) {
      next = due;
    }
    const moving: boolean = timed.rebindAt >= 0 && toHex(timed.address) !== toHex(r.moved);
    if (moving && (next < 0 || timed.rebindAt < next)) {
      next = timed.rebindAt;
    }
    if (next < 0 || next - timed.start > RB_GIVE_UP) {
      break;
    }
    if (next > c.now) {
      c.now = next;
    }
    if (moving && c.now >= timed.rebindAt) {
      timed.address = r.moved;
      c.address = r.moved;
    }
    while (toServer.next() >= 0 && toServer.next() <= c.now) {
      const d: u8[] = toServer.datagrams[toServer.head];
      r.conn.receiveWindowFrom(d, n32(0), toI32(d.length), toServer.from[toServer.head], c.now);
      toServer.head = toServer.head + 1;
    }
    rbTimedClient(r, timed, toClient, toServer);
    if (timed.holeAt >= 0 && timed.rebindAt < 0) {
      timed.rebindAt = timed.holeAt + RB_RTT / 4;
    }
    r.conn.handleTimer(c.now);
    rbTimedSend(r, timed, toClient);
  }
  if (timed.contiguous >= RB_TARGET) {
    timed.doneAt = c.now;
  }
  return timed;
};

/** A fresh transfer under the interop configuration with a stream buffer of `window` bytes. */
const rbTransfer = (window: i64): Rebind => {
  const config: QuicServerConfig = interopQuicConfig([leafCertificate()], false);
  config.maxStreamData = window;
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  return new Rebind(new QuicConnection(config, fixedEntropy()), c);
};

/** The runner's `rebind-port` case at a 64 KiB buffer, played in time, and at the configuration's own. */
export const rebindChecks = (t: Suite): void => {
  const small: Rebind = rbTransfer(n64(65536));
  const smallStall: u8[][] = rbStall(t, small);
  t.ok("a 64 KiB buffer: the first data packet is lost, and an ACK of the rest reports it", small.hole === n64(0) && small.sentEnd === n64(65536));
  t.ok(
    "in the round trip that follows the server sends the hole again and nothing new: its buffer is 64 KiB past the hole",
    toI32(smallStall.length) === n32(1) && small.sentEnd === small.hole + n64(65536)
  );

  // Played in time, the rebind lands after the client acknowledged the
  // hole's resend and before the server's next burst: half a round trip in
  // which nothing would be on its way to the client.
  const timedRun: Rebind = rbTransfer(n64(65536));
  const timed: RbTimed = rbTimedTransfer(t, timedRun);
  t.ok("played in time, the rebind comes after the client received the hole's resend", timed.holeAt >= 0 && timed.rebindAt === timed.holeAt + RB_RTT / 4);
  // The early probe left half a round trip after the resend arrives one way
  // later, and the client's ACK of it from the new port one way after that:
  // under two round trips from the rebind.
  t.ok(
    "the server's early probe draws an ACK from the new port, and the server follows within two round trips",
    timed.followedAt >= timed.rebindAt && timed.followedAt - timed.rebindAt < RB_RTT * 2
  );
  // Four buffers of 64 KiB take four round trips at least; the hole, the
  // burst the NAT dropped (one probe timeout, about three round trips) and
  // the new path's validation add a few more. Twenty round trips is half
  // again what the transfer takes; without the probe it never ends.
  t.ok(
    "and 256 KiB, four buffers, arrive in order within twenty round trips",
    timed.contiguous === RB_TARGET && timed.doneAt >= 0 && timed.doneAt - timed.start <= RB_RTT * 20
  );

  const config: QuicServerConfig = interopQuicConfig([leafCertificate()], false);
  const shipped: Rebind = rbTransfer(config.maxStreamData);
  const stall: u8[][] = rbStall(t, shipped);
  t.ok("the interop buffer: the same loss, reported the same way", shipped.hole === n64(0) && shipped.sentEnd > n64(65536));
  t.ok(
    "in the round trip that follows the server sends the hole again and new data with it, past 64 KiB and the path's flight",
    toI32(stall.length) > n32(2) && shipped.sentEnd - shipped.hole > RB_FLIGHT
  );
  rbRebind(shipped, stall);
  t.ok("the client acknowledges what arrives after the rebind from the new port, and the server follows it", toHex(shipped.conn.sendAddress()) === toHex(shipped.moved));
  t.ok("and new data reaches the client there", shipped.gotEnd > shipped.rebindEnd);
};

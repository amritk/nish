// DATAGRAM frames (RFC 9221) inside `nish/net/quic`: one exactly at the
// size the server offered is taken and one byte over is PROTOCOL_VIOLATION,
// as is any when it offered none; the server sends one exactly at the size
// the client takes, or at what fits a 1200-byte packet, and refuses one
// byte over; a datagram goes within the congestion window and is never sent
// again; each way is a ring of eight; and a run of datagrams both ways keeps
// no arena memory.
import { Suite } from "nish/testing";
import {
  QUIC_ERROR_PROTOCOL_VIOLATION,
  QUIC_FRAME_CONNECTION_CLOSE,
  QUIC_FRAME_DATAGRAM,
  QUIC_FRAME_DATAGRAM_LENGTH,
  QUIC_FRAME_PING,
  QuicFrame,
  quicDatagramSize,
  quicParseFrame,
  quicPushAck,
  quicPutDatagram,
} from "nish/net/quic-frame";
import {
  QUIC_CONN_DATAGRAM_QUEUE,
  QUIC_DATAGRAM_ERR_DISABLED,
  QUIC_DATAGRAM_ERR_FULL,
  QUIC_DATAGRAM_ERR_ROOM,
  QUIC_DATAGRAM_ERR_TOO_BIG,
  QUIC_DATAGRAM_NONE,
  QUIC_DATAGRAM_OK,
  QUIC_STATE_CLOSING,
  QuicConnection,
} from "nish/net/quic";
import { bytesOf, textOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { cat } from "../net_tls_common/client";
import { QcClient, qcDrain, qcShort } from "../net_quic_conn/client";
import { qcFind } from "../net_quic_conn/common";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { NqLimits, NqPair, nqAck, nqConfig, nqPair, nqSend, nqText } from "../net_quic_stream/common";
import { NqMeter, nqMeteredDrain, nqMeteredReceive } from "../net_quic_stream/arena";

/** A DATAGRAM frame with a Length (0x31) carrying `text`. */
const withLength = (text: string): u8[] => {
  const data: u8[] = bytesOf(text);
  const size: i32 = quicDatagramSize(toI32(data.length));
  const out: u8[] = new Array<u8>(size);
  quicPutDatagram(out, n32(0), size, data, n32(0), toI32(data.length));
  return out;
};

/** A DATAGRAM frame without a Length (0x30), which runs to the end of its packet. */
const toEnd = (text: string): u8[] => cat([[toU8(QUIC_FRAME_DATAGRAM)], bytesOf(text)]);

/** The payloads of every DATAGRAM frame the client received, as text. */
const receivedParts = (c: QcClient): string[] => {
  const parts: string[] = [];
  const frame = new QuicFrame();
  for (const payload of c.appPayloads) {
    let at: i32 = 0;
    while (at < toI32(payload.length)) {
      if (quicParseFrame(frame, payload, at, toI32(payload.length)) !== n64(0) || frame.end <= at) {
        break;
      }
      if (frame.type === QUIC_FRAME_DATAGRAM) {
        const data: u8[] = [];
        for (let k: i32 = 0; k < frame.dataLength; k++) {
          data.push(payload[frame.dataStart + k]);
        }
        parts.push(textOf(data));
      }
      at = frame.end;
    }
  }
  return parts;
};

/** The same, joined with `|`. */
const received = (c: QcClient): string => receivedParts(c).join("|");

/** Reads the next datagram the server holds, as text, or `none`. */
const readOne = (conn: QuicConnection): string => {
  const buf: u8[] = new Array<u8>(1200);
  const n: i32 = conn.readDatagram(buf, n32(0), n32(1200));
  if (n < 0) {
    return "none";
  }
  const data: u8[] = [];
  for (let k: i32 = 0; k < n; k++) {
    data.push(buf[k]);
  }
  return textOf(data);
};

/** Limits that offer DATAGRAM frames of up to 100 bytes, to a client that takes up to `client`. */
const offering = (client: i64): NqLimits => {
  const limits = new NqLimits();
  limits.maxDatagramFrameSize = n64(100);
  limits.clientDatagram = client;
  return limits;
};

/** What the server takes: exactly at its limit, one byte over, and none at all. */
const receiveChecks = (t: Suite): void => {
  const p: NqPair = nqPair(offering(n64(200)));
  const at: string = nqText(n32(97));
  t.eqI32("97 bytes make a DATAGRAM frame of exactly 100: type, a two-byte Length, the payload", quicDatagramSize(n32(97)), n32(100));
  nqSend(p, withLength(at));
  t.eqStr("one at the server's max_datagram_frame_size of 100 is taken (RFC 9221 §3)", readOne(p.conn), at);
  nqSend(p, toEnd(nqText(n32(99))));
  t.eqStr("so is one without a Length that runs to the packet's end, 100 bytes with its type", readOne(p.conn), nqText(n32(99)));
  t.eqStr("and with nothing more, nothing is read", readOne(p.conn), "none");
  t.eqI32("which readDatagram answers as QUIC_DATAGRAM_NONE", p.conn.readDatagram(new Array<u8>(4), n32(0), n32(4)), QUIC_DATAGRAM_NONE);
  nqSend(p, withLength("abcdef"));
  t.eqI32("a datagram larger than the room given is kept: QUIC_DATAGRAM_ERR_ROOM", p.conn.readDatagram(new Array<u8>(4), n32(0), n32(4)), QUIC_DATAGRAM_ERR_ROOM);
  t.eqStr("and read whole with room", readOne(p.conn), "abcdef");
  const many: u8[][] = [];
  for (let k: i32 = 0; k < 9; k++) {
    many.push(withLength(`d${k}`));
  }
  nqSend(p, cat(many));
  t.eqI32("nine at once fill the ring of eight; the ninth is dropped, as a datagram may be", p.conn.datagramsIn.dropped, n32(1));
  let all: string = "";
  for (let k: i32 = 0; k < 8; k++) {
    all = `${all}${readOne(p.conn)}`;
  }
  t.eqStr("and the eight are read in order", all, "d0d1d2d3d4d5d6d7");

  const over: NqPair = nqPair(offering(n64(200)));
  nqSend(over, withLength(nqText(n32(98))));
  t.ok("one byte over, 101, is PROTOCOL_VIOLATION (RFC 9221 §3)", over.conn.state === QUIC_STATE_CLOSING && over.conn.error === QUIC_ERROR_PROTOCOL_VIOLATION);
  const close = qcFind(over.c.appPayloads, QUIC_FRAME_CONNECTION_CLOSE);
  t.ok("naming the DATAGRAM frame's type, 0x31", close.found && close.frame.frameType === toI64(QUIC_FRAME_DATAGRAM_LENGTH));
  const overToEnd: NqPair = nqPair(offering(n64(200)));
  nqSend(overToEnd, toEnd(nqText(n32(100))));
  t.ok("so is one without a Length of 101", overToEnd.conn.error === QUIC_ERROR_PROTOCOL_VIOLATION);
  const closeToEnd = qcFind(overToEnd.c.appPayloads, QUIC_FRAME_CONNECTION_CLOSE);
  t.ok("naming 0x30", closeToEnd.found && closeToEnd.frame.frameType === toI64(QUIC_FRAME_DATAGRAM));
  const none: NqPair = nqPair(new NqLimits());
  nqSend(none, withLength("x"));
  t.ok("with no max_datagram_frame_size offered, any DATAGRAM is PROTOCOL_VIOLATION", none.conn.state === QUIC_STATE_CLOSING && none.conn.error === QUIC_ERROR_PROTOCOL_VIOLATION);
};

/** What the server sends: exactly at the client's limit, at the MTU edge, and not past either. */
const sendChecks = (t: Suite): void => {
  const p: NqPair = nqPair(offering(n64(200)));
  t.eqI32("the client takes 200-byte frames: a payload of 197", p.conn.maxDatagramPayload(), n32(197));
  const exact: u8[] = bytesOf(nqText(n32(197)));
  t.eqI32("exactly 197 is queued", p.conn.sendDatagram(exact, n32(0), n32(197)), QUIC_DATAGRAM_OK);
  const over: u8[] = bytesOf(nqText(n32(198)));
  t.eqI32("one byte over is QUIC_DATAGRAM_ERR_TOO_BIG", p.conn.sendDatagram(over, n32(0), n32(198)), QUIC_DATAGRAM_ERR_TOO_BIG);
  qcDrain(p.conn, p.c);
  t.eqStr("the 197 arrive", received(p.c), nqText(n32(197)));

  const edge: NqPair = nqPair(offering(n64(65535)));
  t.eqI32("a client that takes any size gets what fits a 1200-byte packet: 1168", edge.conn.maxDatagramPayload(), n32(1168));
  const full: u8[] = bytesOf(nqText(n32(1168)));
  t.eqI32("1168 bytes are queued", edge.conn.sendDatagram(full, n32(0), n32(1168)), QUIC_DATAGRAM_OK);
  const bigger: u8[] = bytesOf(nqText(n32(1169)));
  t.eqI32("1169 are QUIC_DATAGRAM_ERR_TOO_BIG", edge.conn.sendDatagram(bigger, n32(0), n32(1169)), QUIC_DATAGRAM_ERR_TOO_BIG);
  const from: i32 = toI32(edge.c.datagrams.length);
  qcDrain(edge.conn, edge.c);
  t.ok("the 1168 go in one datagram of at most 1200 bytes", toI32(edge.c.datagrams.length) === from + 1 && toI32(edge.c.datagrams[from].length) <= n32(1200));
  t.eqStr("and arrive whole", received(edge.c), nqText(n32(1168)));

  const off: NqPair = nqPair(offering(n64(0)));
  t.eqI32("a client that takes no DATAGRAM frames gets none: QUIC_DATAGRAM_ERR_DISABLED", off.conn.sendDatagram(exact, n32(0), n32(1)), QUIC_DATAGRAM_ERR_DISABLED);
  t.eqI32("and its maxDatagramPayload is 0", off.conn.maxDatagramPayload(), n32(0));
  const early = new QuicConnection(nqConfig(offering(n64(200))), fixedEntropy());
  t.eqI32("nor does a connection before its handshake", early.sendDatagram(exact, n32(0), n32(1)), QUIC_DATAGRAM_ERR_DISABLED);

  const ring: NqPair = nqPair(offering(n64(200)));
  for (let k: i32 = 0; k < QUIC_CONN_DATAGRAM_QUEUE; k++) {
    ring.conn.sendDatagram(exact, n32(0), n32(10));
  }
  t.eqI32("a ninth waiting is QUIC_DATAGRAM_ERR_FULL", ring.conn.sendDatagram(exact, n32(0), n32(10)), QUIC_DATAGRAM_ERR_FULL);
  qcDrain(ring.conn, ring.c);
  t.eqI32("the eight go together", toI32(receivedParts(ring.c).length), n32(8));
  t.eqI32("and the ring takes more", ring.conn.sendDatagram(exact, n32(0), n32(10)), QUIC_DATAGRAM_OK);
};

/** A datagram waits for the congestion window, and a lost one is not sent again. */
const recoveryChecks = (t: Suite): void => {
  const p: NqPair = nqPair(offering(n64(200)));
  const data: u8[] = bytesOf("held");
  p.conn.recovery.congestionWindow = n64(0);
  p.conn.sendDatagram(data, n32(0), n32(4));
  qcDrain(p.conn, p.c);
  t.ok("with the window full the datagram waits (RFC 9221 §5.3)", received(p.c) === "" && p.conn.datagramsOut.count === n32(1));
  p.conn.recovery.congestionWindow = n64(12000);
  qcDrain(p.conn, p.c);
  t.eqStr("and goes once the window opens", received(p.c), "held");
  t.ok("counted as bytes in flight, ack-eliciting", p.conn.recovery.bytesInFlight() > n64(0));
  nqAck(p);

  const lost: NqPair = nqPair(offering(n64(200)));
  // Acknowledge the handshake's packets first, so that the datagram's is the only one in flight.
  nqAck(lost);
  const gone: u8[] = bytesOf("gone");
  lost.conn.sendDatagram(gone, n32(0), n32(4));
  let out: u8[] | null = lost.conn.takeDatagram(lost.c.now);
  t.ok("a datagram goes, and the network loses it", out !== null);
  out = lost.conn.takeDatagram(lost.c.now);
  lost.c.now = lost.conn.deadline();
  lost.conn.handleTimer(lost.c.now);
  qcDrain(lost.conn, lost.c);
  t.eqStr("the probe timeout's probe does not carry it again (RFC 9221 §5.2)", received(lost.c), "");
  const n: i32 = toI32(lost.c.appPayloads.length);
  t.ok("with nothing else in flight, it is a PING", n > 0 && qcFind([lost.c.appPayloads[n - 1]], QUIC_FRAME_PING).found);
};

/** An ACK frame of every 1-RTT packet the client has had, or nothing before the first. */
const ackAll = (c: QcClient): u8[] => {
  const out: u8[] = [];
  if (c.largestApp >= n64(0)) {
    const ranges: i64[] = [n64(0), c.largestApp];
    quicPushAck(out, ranges, n32(1), n64(0));
  }
  return out;
};

/** Datagrams both ways, round after round, keep no arena memory once warm. */
const datagramArenaChecks = (t: Suite): void => {
  const p: NqPair = nqPair(offering(n64(200)));
  const meter = new NqMeter(false);
  const warm = new NqMeter(false);
  const buf: u8[] = new Array<u8>(256);
  for (let k: i32 = 0; k < 220; k++) {
    const m: NqMeter = k < 20 ? warm : meter;
    nqMeteredReceive(p.conn, qcShort(p.c, cat([withLength(nqText(n32(50) + (k % n32(40)))), ackAll(p.c)])), p.c.now, m);
    const before: i64 = Arena.used();
    const n: i32 = p.conn.readDatagram(buf, n32(0), n32(256));
    if (n > 0) {
      p.conn.sendDatagram(buf, n32(0), n);
    }
    m.kept = m.kept + (Arena.used() - before);
    nqMeteredDrain(p.conn, p.c, m);
  }
  t.eqI64("200 datagrams in, their echoes out, and the ACKs, keep no arena memory", meter.kept, n64(0));
  t.eqI32("and every echo arrived", toI32(receivedParts(p.c).length), n32(220));
};

/** Every datagram check. */
export const datagramChecks = (t: Suite): void => {
  receiveChecks(t);
  sendChecks(t);
  recoveryChecks(t);
  datagramArenaChecks(t);
};

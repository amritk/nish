// The `put` writers, which write a frame in place into a caller's buffer:
// each writes the same bytes as its `push` form, refuses (answering -1 and
// writing nothing) when the frame does not fit before the end it is given,
// and `quicPutStream` reads a ring that wraps. RFC 9221's DATAGRAM frames,
// 0x30 and 0x31, are read, and allowed only where 0-RTT and 1-RTT data is.
import { Suite } from "nish/testing";
import { QUIC_PACKET_HANDSHAKE, QUIC_PACKET_INITIAL, QUIC_PACKET_SHORT, QUIC_PACKET_ZERO_RTT } from "nish/net/quic-packet";
import {
  QUIC_ERROR_FRAME_ENCODING,
  QUIC_FRAME_DATAGRAM,
  QUIC_FRAME_MAX_DATA,
  QUIC_FRAME_MAX_STREAM_DATA,
  QUIC_FRAME_PATH_RESPONSE,
  QUIC_FRAME_PING,
  QuicFrame,
  quicAckSize,
  quicDatagramSize,
  quicFrameAckEliciting,
  quicFrameAllowed,
  quicParseFrame,
  quicPushAck,
  quicPushConnectionClose,
  quicPushCrypto,
  quicPushNewConnectionId,
  quicPushPathData,
  quicPushStream,
  quicPushStreamError,
  quicPushStreamValue,
  quicPushValue,
  quicPutAck,
  quicPutConnectionClose,
  quicPutCrypto,
  quicPutDatagram,
  quicPutNewConnectionId,
  quicPutPadding,
  quicPutPathData,
  quicPutStream,
  quicPutStreamError,
  quicPutStreamValue,
  quicPutTypeOnly,
  quicPutValue,
} from "nish/net/quic-frame";
import { fromHex, toHex } from "../crypto_x509/hex";
import { n32, n64 } from "./typed";
import { windowHex } from "./checks";

/** Whether `buf` is all zero, which a refused `put` leaves it. */
const untouched = (buf: u8[]): boolean => {
  let zero: boolean = true;
  for (const b of buf) {
    zero = zero && toI32(b) === 0;
  }
  return zero;
};

/** Each `put` writer writes what its `push` form appends, and refuses one byte short of room. */
const sameAsPush = (t: Suite): void => {
  const buf: u8[] = new Array<u8>(64);
  const data: u8[] = fromHex("00112233445566778899");
  const ranges: i64[] = [n64(10), n64(12), n64(5), n64(7)];
  const ack: u8[] = [];
  quicPushAck(ack, ranges, n32(2), n64(9));
  const ackSize: i32 = quicAckSize(ranges, n32(2), n64(9));
  t.eqI32("quicAckSize sizes the ACK quicPushAck writes", ackSize, toI32(ack.length));
  t.eqI32("quicPutAck writes it in place", quicPutAck(buf, n32(0), n32(64), ranges, n32(2), n64(9)), ackSize);
  t.eqStr("the same bytes", windowHex(buf, n32(0), ackSize), toHex(ack));
  const short: u8[] = new Array<u8>(64);
  t.eqI32("one byte short of room, it writes nothing", quicPutAck(short, n32(0), ackSize - 1, ranges, n32(2), n64(9)), n32(-1));
  t.ok("and leaves the buffer as it was", untouched(short));
  t.eqI32("an ACK with no ranges is refused", quicPutAck(buf, n32(0), n32(64), ranges, n32(0), n64(0)), n32(-1));

  const crypto: u8[] = [];
  quicPushCrypto(crypto, n64(1000), data, n32(2), n32(5));
  t.eqI32("quicPutCrypto", quicPutCrypto(buf, n32(0), n32(64), n64(1000), data, n32(2), n32(5)), toI32(crypto.length));
  t.eqStr("writes quicPushCrypto's bytes", windowHex(buf, n32(0), toI32(crypto.length)), toHex(crypto));
  t.eqI32("and refuses a window outside the data", quicPutCrypto(short, n32(0), n32(64), n64(0), data, n32(8), n32(5)), n32(-1));

  const stream: u8[] = [];
  quicPushStream(stream, n64(4), n64(300), data, n32(0), n32(10), true);
  t.eqI32("quicPutStream", quicPutStream(buf, n32(0), n32(64), n64(4), n64(300), data, n32(0), n32(10), true), toI32(stream.length));
  t.eqStr("writes quicPushStream's bytes", windowHex(buf, n32(0), toI32(stream.length)), toHex(stream));
  t.eqI32("and refuses a length past its data", quicPutStream(short, n32(0), n32(64), n64(4), n64(0), data, n32(0), n32(11), false), n32(-1));

  const value: u8[] = [];
  quicPushValue(value, QUIC_FRAME_MAX_DATA, n64(70000));
  t.eqI32("quicPutValue", quicPutValue(buf, n32(0), n32(64), QUIC_FRAME_MAX_DATA, n64(70000)), toI32(value.length));
  t.eqStr("writes quicPushValue's bytes", windowHex(buf, n32(0), toI32(value.length)), toHex(value));
  t.eqI32("and refuses a type it does not write", quicPutValue(short, n32(0), n32(64), QUIC_FRAME_PING, n64(1)), n32(-1));

  const streamValue: u8[] = [];
  quicPushStreamValue(streamValue, QUIC_FRAME_MAX_STREAM_DATA, n64(8), n64(5000));
  t.eqI32("quicPutStreamValue", quicPutStreamValue(buf, n32(0), n32(64), QUIC_FRAME_MAX_STREAM_DATA, n64(8), n64(5000)), toI32(streamValue.length));
  t.eqStr("writes quicPushStreamValue's bytes", windowHex(buf, n32(0), toI32(streamValue.length)), toHex(streamValue));
  t.eqI32("and refuses another type", quicPutStreamValue(short, n32(0), n32(64), QUIC_FRAME_PING, n64(8), n64(1)), n32(-1));

  const cid: u8[] = fromHex("0102030405060708");
  const token: u8[] = fromHex("a0a1a2a3a4a5a6a7a8a9aaabacadaeaf");
  const ncid: u8[] = [];
  quicPushNewConnectionId(ncid, n64(3), n64(1), cid, token);
  // The ID is the first 8 bytes of a 20-byte slot, as a connection-ID table keeps it.
  const slot: u8[] = new Array<u8>(20);
  for (let k: i32 = 0; k < 8; k++) {
    slot[k] = cid[k];
  }
  t.eqI32("quicPutNewConnectionId of the first 8 bytes of a 20-byte slot", quicPutNewConnectionId(buf, n32(0), n32(64), n64(3), n64(1), slot, n32(8), token), toI32(ncid.length));
  t.eqStr("writes quicPushNewConnectionId's bytes", windowHex(buf, n32(0), toI32(ncid.length)), toHex(ncid));
  t.eqI32("and refuses a length past the slot", quicPutNewConnectionId(short, n32(0), n32(64), n64(3), n64(1), slot, n32(21), token), n32(-1));

  const path: u8[] = [];
  quicPushPathData(path, QUIC_FRAME_PATH_RESPONSE, data, n32(1));
  t.eqI32("quicPutPathData", quicPutPathData(buf, n32(0), n32(64), QUIC_FRAME_PATH_RESPONSE, data, n32(1)), toI32(path.length));
  t.eqStr("writes quicPushPathData's bytes", windowHex(buf, n32(0), toI32(path.length)), toHex(path));
  t.eqI32("and refuses a type it does not write", quicPutPathData(short, n32(0), n32(64), QUIC_FRAME_PING, data, n32(0)), n32(-1));

  const reset: u8[] = [];
  quicPushStreamError(reset, n64(4), n64(7), n64(300));
  t.eqI32("quicPutStreamError", quicPutStreamError(buf, n32(0), n32(64), n64(4), n64(7), n64(300)), toI32(reset.length));
  t.eqStr("writes quicPushStreamError's bytes", windowHex(buf, n32(0), toI32(reset.length)), toHex(reset));
  t.eqI32("and refuses no room", quicPutStreamError(short, n32(0), n32(2), n64(4), n64(7), n64(300)), n32(-1));

  const close: u8[] = [];
  const reason: u8[] = fromHex("6f6b");
  quicPushConnectionClose(close, false, n64(10), n64(8), reason);
  t.eqI32("quicPutConnectionClose", quicPutConnectionClose(buf, n32(0), n32(64), false, n64(10), n64(8), reason), toI32(close.length));
  t.eqStr("writes quicPushConnectionClose's bytes", windowHex(buf, n32(0), toI32(close.length)), toHex(close));
  t.eqI32("and refuses no room", quicPutConnectionClose(short, n32(0), n32(3), false, n64(10), n64(8), reason), n32(-1));

  t.eqI32("quicPutTypeOnly writes PING", quicPutTypeOnly(buf, n32(0), n32(1), QUIC_FRAME_PING), n32(1));
  t.eqI32("and refuses a type with a body", quicPutTypeOnly(buf, n32(0), n32(1), QUIC_FRAME_MAX_DATA), n32(-1));
  t.eqI32("quicPutPadding writes zeros up to the buffer's end", quicPutPadding(buf, n32(60), n32(10)), n32(64));
  t.ok("and they are zero", windowHex(buf, n32(0), n32(64)).endsWith("00000000"));
};

/** A STREAM frame read from a ring that wraps, and DATAGRAM frames both ways. */
const ringAndDatagram = (t: Suite): void => {
  // A ring of 8 holding the stream's bytes 5 to 9 at 5..7 and 0..1.
  const ring: u8[] = fromHex("aabb000000010203");
  const buf: u8[] = new Array<u8>(32);
  const end: i32 = quicPutStream(buf, n32(0), n32(32), n64(0), n64(5), ring, n32(5), n32(5), false);
  const frame = new QuicFrame();
  t.eqI64("a STREAM frame read from a ring that wraps parses", quicParseFrame(frame, buf, n32(0), end), n64(0));
  t.eqStr("with the ring's tail and then its head, in order", windowHex(buf, n32(0), end).substring(toI32(windowHex(buf, n32(0), end).length) - 10), "010203aabb");

  const payload: u8[] = fromHex("68656c6c6f");
  t.eqI32("quicDatagramSize: type, Length and payload", quicDatagramSize(n32(5)), n32(7));
  t.eqI32("quicPutDatagram writes type 0x31 with a Length", quicPutDatagram(buf, n32(0), n32(32), payload, n32(0), n32(5)), n32(7));
  t.eqStr("as 31 05 and the bytes", windowHex(buf, n32(0), n32(7)), "310568656c6c6f");
  t.eqI32("and refuses no room", quicPutDatagram(buf, n32(0), n32(6), payload, n32(0), n32(5)), n32(-1));
  t.eqI64("0x31 reads back", quicParseFrame(frame, buf, n32(0), n32(7)), n64(0));
  t.ok("as DATAGRAM, its payload a window, and `fin` saying it had a Length", frame.type === QUIC_FRAME_DATAGRAM && frame.dataStart === n32(2) && frame.dataLength === n32(5) && frame.fin);
  const toEnd: u8[] = fromHex("3068656c6c6f");
  t.eqI64("0x30 reads to the packet's end", quicParseFrame(frame, toEnd, n32(0), n32(6)), n64(0));
  t.ok("with no Length", frame.type === QUIC_FRAME_DATAGRAM && frame.dataLength === n32(5) && !frame.fin && frame.end === n32(6));
  t.eqI64("a 0x31 whose Length runs past the packet is FRAME_ENCODING_ERROR", quicParseFrame(frame, fromHex("310968656c"), n32(0), n32(5)), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("so is a type past 0x31", quicParseFrame(frame, fromHex("32"), n32(0), n32(1)), QUIC_ERROR_FRAME_ENCODING);
  t.ok(
    "DATAGRAM goes in 0-RTT and 1-RTT packets only (RFC 9221 §4)",
    quicFrameAllowed(QUIC_FRAME_DATAGRAM, QUIC_PACKET_SHORT) &&
      quicFrameAllowed(QUIC_FRAME_DATAGRAM, QUIC_PACKET_ZERO_RTT) &&
      !quicFrameAllowed(QUIC_FRAME_DATAGRAM, QUIC_PACKET_INITIAL) &&
      !quicFrameAllowed(QUIC_FRAME_DATAGRAM, QUIC_PACKET_HANDSHAKE)
  );
  t.ok("and elicits an acknowledgement (RFC 9221 §5.2)", quicFrameAckEliciting(QUIC_FRAME_DATAGRAM));
};

/** Every check of the in-place writers and of DATAGRAM. */
export const inPlaceChecks = (t: Suite): void => {
  sameAsPush(t);
  ringAndDatagram(t);
};

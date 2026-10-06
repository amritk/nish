// What Q4 added to the parts: RFC 9221's `max_datagram_frame_size` both
// ways; the ACK frame written in place and the ranges cleared for a reused
// slot; the connection-ID table's fixed slots, read from a packet in place,
// with its retirements in a ring and a reset; and the datagram ring.
import { Suite } from "nish/testing";
import { QUIC_ERROR_NO_ERROR, QUIC_ERROR_TRANSPORT_PARAMETER, QUIC_FRAME_DATAGRAM, QuicFrame, quicParseFrame } from "nish/net/quic-frame";
import {
  QUIC_TP_MAX_DATAGRAM_FRAME_SIZE,
  QuicTransportParameters,
  quicEncodeTransportParameters,
  quicParseTransportParameters,
} from "nish/net/quic-conn-params";
import { QuicAckRanges } from "nish/net/quic-conn-ack";
import { QuicCidEntry, QuicCidTable } from "nish/net/quic-conn-cid";
import { QuicDatagramQueue } from "nish/net/quic-datagram";
import { fromHex, toHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";

/** The first `n` bytes of `buf`, as hex. */
const headHex = (buf: u8[], n: i32): string => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < n && k < toI32(buf.length); k++) {
    out.push(buf[k]);
  }
  return toHex(out);
};

/** `max_datagram_frame_size` written only when offered, read back, and refused when sent twice or malformed. */
const datagramParameterChecks = (t: Suite): void => {
  const p = new QuicTransportParameters();
  t.eqStr("a value of 0, the default, is not written", toHex(quicEncodeTransportParameters(p)), "");
  p.maxDatagramFrameSize = n64(1200);
  const encoded: u8[] = quicEncodeTransportParameters(p);
  t.eqStr("1200 is written as ID 0x20, a length of 2, and the varint", toHex(encoded), "200244b0");
  t.eqI32("the ID is RFC 9221's", QUIC_TP_MAX_DATAGRAM_FRAME_SIZE, n32(0x20));
  const back: QuicTransportParameters = quicParseTransportParameters(encoded, false);
  t.ok("and read back", back.error === QUIC_ERROR_NO_ERROR && back.maxDatagramFrameSize === n64(1200));
  const twice: QuicTransportParameters = quicParseTransportParameters(fromHex("200244b0200244b0"), false);
  t.ok("sent twice it is TRANSPORT_PARAMETER_ERROR, naming 0x20", twice.error === QUIC_ERROR_TRANSPORT_PARAMETER && twice.errorParameter === n64(0x20));
  const loose: QuicTransportParameters = quicParseTransportParameters(fromHex("200344b000"), false);
  t.ok("so is a value that is not exactly one varint", loose.error === QUIC_ERROR_TRANSPORT_PARAMETER && loose.errorParameter === n64(0x20));
};

/** The ACK frame in place, and the ranges cleared. */
const ackSlotChecks = (t: Suite): void => {
  const r = new QuicAckRanges();
  const buf: u8[] = new Array<u8>(32);
  t.eqI32("with nothing received, putAck writes nothing", r.putAck(buf, n32(0), n32(32), n64(0)), n32(-1));
  r.record(n64(0), true);
  r.record(n64(1), true);
  r.record(n64(5), true);
  t.eqI32("with too little room it writes nothing", r.putAck(buf, n32(0), n32(3), n64(0)), n32(-1));
  t.ok("and the ACK stays due", r.ackPending);
  const end: i32 = r.putAck(buf, n32(0), n32(32), n64(0));
  const pushed: u8[] = [];
  const again = new QuicAckRanges();
  again.record(n64(0), true);
  again.record(n64(1), true);
  again.record(n64(5), true);
  again.pushAck(pushed, n64(0));
  t.eqStr("putAck writes what pushAck appends", headHex(buf, end), toHex(pushed));
  t.ok("and it is no longer due", !r.ackPending);
  r.clear();
  t.ok("clear forgets every packet number, for a reused slot", r.count === n32(0) && r.largest === n64(-1) && !r.contains(n64(1)));
};

/** The connection-ID table's fixed slots. */
const cidSlotChecks = (t: Suite): void => {
  const ids = new QuicCidTable(n64(2), n32(2));
  const token: u8[] = fromHex("000102030405060708090a0b0c0d0e0f");
  const none: u8[] = [];
  ids.addLocal(fromHex("0000000000000000"), none);
  ids.addLocal(fromHex("1111111111111111"), token);
  t.eqI64("with both local slots taken, a third ID is refused: -1", ids.addLocal(fromHex("2222222222222222"), token), n64(-1));
  // A packet whose DCID, the second ID, is at offset 1.
  const packet: u8[] = fromHex("40111111111111111101");
  t.ok("ownsLocalAt reads an ID from a packet in place", ids.ownsLocalAt(packet, n32(1), n32(8)));
  t.ok("at the length it was issued with only", !ids.ownsLocalAt(packet, n32(1), n32(7)));
  t.eqI64("retiring sequence 0 in a packet sent to 1 is fine", ids.retireLocal(n64(0), packet, n32(1), n32(8)), QUIC_ERROR_NO_ERROR);
  t.eqI64("which frees its slot for the next", ids.addLocal(fromHex("3333333333333333"), token), n64(2));

  // A NEW_CONNECTION_ID frame: sequence 1, Retire Prior To 0, a 2-byte ID and its token.
  const frameBytes: u8[] = fromHex("18010002bbcc000102030405060708090a0b0c0d0e0f");
  const frame = new QuicFrame();
  quicParseFrame(frame, frameBytes, n32(0), toI32(frameBytes.length));
  ids.addPeer(n64(0), n64(0), fromHex("aa"), none);
  t.eqI64(
    "addPeerAt takes the ID and token from the frame in place",
    ids.addPeerAt(frame.value, frame.retirePriorTo, frameBytes, frame.connectionIdStart, frame.connectionIdLength, frameBytes, frame.resetTokenStart, true),
    QUIC_ERROR_NO_ERROR
  );
  const current: QuicCidEntry | null = ids.currentPeerEntry();
  t.ok("the oldest is still the one sent to, in its slot", current !== null && current.length === n32(1) && current.sequence === n64(0));
  t.eqI64("an ID longer than 20 bytes is refused", ids.addPeerAt(n64(2), n64(0), new Array<u8>(30), n32(0), n32(21), token, n32(0), true), n64(0x0a));
  ids.queueRetire(n64(7));
  ids.queueRetire(n64(7));
  t.eqI32("a retirement queued twice is owed once", ids.retireCount, n32(1));
  for (let k: i32 = 0; k < 8; k++) {
    ids.queueRetire(toI64(k) + n64(10));
  }
  t.eqI32("and the ring holds twice the limit, no more", ids.retireCount, n32(4));
  ids.reset();
  t.ok(
    "reset empties every slot and the ring, for the next connection",
    ids.activeLocal() === n32(0) && ids.activePeer() === n32(0) && ids.retireCount === n32(0) && ids.currentPeerEntry() === null && ids.nextLocal === n64(0)
  );
  let zero: boolean = true;
  for (const entry of ids.local) {
    for (const b of entry.resetToken) {
      zero = zero && toI32(b) === 0;
    }
  }
  t.ok("with every token zeroed", zero);
};

/** The datagram ring. */
const datagramRingChecks = (t: Suite): void => {
  const ring = new QuicDatagramQueue(n32(2), n32(4));
  const data: u8[] = fromHex("0102030405");
  t.eqI32("it holds two", ring.capacity(), n32(2));
  t.ok("a payload past its entry size is refused and counted", !ring.push(data, n32(0), n32(5)) && ring.dropped === n32(1));
  t.ok("so is a window outside the array", !ring.push(data, n32(3), n32(4)) && ring.dropped === n32(2));
  t.ok("two fit", ring.push(data, n32(0), n32(4)) && ring.push(data, n32(1), n32(3)));
  t.ok("a third does not", !ring.push(data, n32(0), n32(1)) && ring.dropped === n32(3));
  const out: u8[] = new Array<u8>(8);
  t.eqI32("the oldest is 4 bytes", ring.peekLength(), n32(4));
  t.eqI32("it does not fit in 3: kept", ring.pop(out, n32(0), n32(3)), n32(-2));
  t.eqI32("it is popped whole", ring.pop(out, n32(0), n32(8)), n32(4));
  t.eqStr("in order", headHex(out, n32(4)), "01020304");
  t.eqI32("a frame with no room is not written", ring.putFrame(out, n32(0), n32(4)), n32(0));
  const end: i32 = ring.putFrame(out, n32(0), n32(8));
  const frame = new QuicFrame();
  t.ok("the next goes out as a DATAGRAM frame", end === n32(5) && quicParseFrame(frame, out, n32(0), end) === n64(0) && frame.type === QUIC_FRAME_DATAGRAM && headHex(out, n32(5)) === "3103020304");
  t.eqI32("and the ring is empty", ring.pop(out, n32(0), n32(8)), n32(-1));
  ring.push(data, n32(0), n32(1));
  ring.reset();
  t.ok("reset empties it and its count", ring.count === n32(0) && ring.dropped === n32(0));
};

/** Every check of what the slot discipline added to the parts. */
export const partsSlotChecks = (t: Suite): void => {
  datagramParameterChecks(t);
  ackSlotChecks(t);
  cidSlotChecks(t);
  datagramRingChecks(t);
};

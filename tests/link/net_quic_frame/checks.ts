// The checks of `nish/net/quic-frame`, run by `main.ts` in the default number
// mode and by `tests/link/net_quic_frame_f64` under `--number-mode f64`.
//
// RFC 9000 prints no frame vectors of its own, so the two payloads of RFC
// 9001 Appendix A stand in for them: A.2's CRYPTO frame and PADDING, and
// A.3's ACK and CRYPTO. Every other frame is written by its writer, read back
// and pinned as hex, and every refusal the module header names is reached by
// bytes built to reach it alone.
import { Suite } from "nish/testing";
import { QUIC_PACKET_HANDSHAKE, QUIC_PACKET_INITIAL, QUIC_PACKET_RETRY, QUIC_PACKET_SHORT, QUIC_PACKET_ZERO_RTT } from "nish/net/quic-packet";
import {
  QUIC_ERROR_FRAME_ENCODING,
  QUIC_ERROR_INTERNAL,
  QUIC_ERROR_NO_ERROR,
  QUIC_ERROR_PROTOCOL_VIOLATION,
  QUIC_FRAME_ACK,
  QUIC_FRAME_ACK_ECN,
  QUIC_FRAME_CONNECTION_CLOSE,
  QUIC_FRAME_CONNECTION_CLOSE_APP,
  QUIC_FRAME_CRYPTO,
  QUIC_FRAME_DATA_BLOCKED,
  QUIC_FRAME_HANDSHAKE_DONE,
  QUIC_FRAME_MAX_ACK_RANGES,
  QUIC_FRAME_MAX_DATA,
  QUIC_FRAME_MAX_STREAM_DATA,
  QUIC_FRAME_MAX_STREAMS_BIDI,
  QUIC_FRAME_MAX_STREAMS_UNI,
  QUIC_FRAME_NEW_CONNECTION_ID,
  QUIC_FRAME_NEW_TOKEN,
  QUIC_FRAME_PADDING,
  QUIC_FRAME_PATH_CHALLENGE,
  QUIC_FRAME_PATH_RESPONSE,
  QUIC_FRAME_PING,
  QUIC_FRAME_RESET_STREAM,
  QUIC_FRAME_RETIRE_CONNECTION_ID,
  QUIC_FRAME_STOP_SENDING,
  QUIC_FRAME_STREAM,
  QUIC_FRAME_STREAM_DATA_BLOCKED,
  QUIC_FRAME_STREAMS_BLOCKED_BIDI,
  QUIC_FRAME_STREAMS_BLOCKED_UNI,
  QuicFrame,
  quicCryptoOverhead,
  quicFrameAckEliciting,
  quicFrameAllowed,
  quicParseFrame,
  quicPushAck,
  quicPushConnectionClose,
  quicPushCrypto,
  quicPushNewConnectionId,
  quicPushNewToken,
  quicPushPadding,
  quicPushPathData,
  quicPushStream,
  quicPushStreamError,
  quicPushStreamValue,
  quicPushTypeOnly,
  quicPushValue,
  quicStreamOverhead,
} from "nish/net/quic-frame";
import { fromHex, toHex } from "../crypto_x509/hex";
import { a2Payload, a3Payload } from "../net_quic_packet/vectors";
import { inPlaceChecks } from "./inplace";
import { n32, n64 } from "./typed";


/** 2^62 − 1, the largest varint, as a product: an `i64` literal past 2^53 is refused. */
const MAX_VARINT: i64 = 1073741824 * 4294967296 - 1;

/** Parses the one frame `hex` spells, from its first byte to its last, into a fresh frame. */
export const frameOf = (hex: string): QuicFrame => {
  const bytes: u8[] = fromHex(hex);
  const frame = new QuicFrame();
  quicParseFrame(frame, bytes, n32(0), toI32(bytes.length));
  return frame;
};

/** What parsing `hex` as one frame answers: 0, or the transport error. */
export const errorOf = (hex: string): i64 => {
  const bytes: u8[] = fromHex(hex);
  return quicParseFrame(new QuicFrame(), bytes, n32(0), toI32(bytes.length));
};

/** `bytes[from .. from + length)` as hex. */
const windowHex = (bytes: u8[], from: i32, length: i32): string => {
  const out: u8[] = [];
  for (let k: i32 = from; k < from + length && k < toI32(bytes.length); k++) {
    if (k >= 0) {
      out.push(bytes[k]);
    }
  }
  return toHex(out);
};

/** A.2 and A.3, the frames RFC 9001 prints inside its packets. */
const rfcChecks = (t: Suite): void => {
  const crypto: u8[] = fromHex(a2Payload());
  const n: i32 = toI32(crypto.length);
  // A.2 pads the payload to 1162 bytes with PADDING after the CRYPTO frame.
  const padded: u8[] = fromHex(a2Payload());
  quicPushPadding(padded, n32(1162) - n);
  const frame = new QuicFrame();
  t.eqI64("A.2: the CRYPTO frame parses", quicParseFrame(frame, padded, n32(0), toI32(padded.length)), QUIC_ERROR_NO_ERROR);
  t.eqI32("A.2: it is CRYPTO", frame.type, QUIC_FRAME_CRYPTO);
  t.eqI64("A.2: at offset 0", frame.offset, n64(0));
  t.eqI32("A.2: 241 bytes of ClientHello, after the type, offset and two-byte length", frame.dataLength, n32(241));
  t.eqI32("A.2: starting at byte 4", frame.dataStart, n32(4));
  t.eqStr("A.2: the data is the ClientHello", windowHex(padded, frame.dataStart, n32(4)), "010000ed");
  t.eqI32("A.2: the frame ends at 245", frame.end, n);
  t.eqI64("A.2: the PADDING after it parses", quicParseFrame(frame, padded, frame.end, toI32(padded.length)), QUIC_ERROR_NO_ERROR);
  t.eqI32("A.2: as one PADDING frame", frame.type, QUIC_FRAME_PADDING);
  t.eqI32("A.2: running to the end of the payload", frame.end, n32(1162));

  const server: u8[] = fromHex(a3Payload());
  t.eqI64("A.3: the ACK frame parses", quicParseFrame(frame, server, n32(0), toI32(server.length)), QUIC_ERROR_NO_ERROR);
  t.eqI32("A.3: it is ACK", frame.type, QUIC_FRAME_ACK);
  t.eqI64("A.3: of packet 0", frame.largest, n64(0));
  t.eqI64("A.3: with no delay", frame.ackDelay, n64(0));
  t.eqI32("A.3: one range", frame.ackRangeCount, n32(1));
  t.ok("A.3: [0, 0]", frame.ackRanges[0] === n64(0) && frame.ackRanges[1] === n64(0));
  t.eqI32("A.3: five bytes", frame.end, n32(5));
  t.eqI64("A.3: the CRYPTO frame after it parses", quicParseFrame(frame, server, frame.end, toI32(server.length)), QUIC_ERROR_NO_ERROR);
  t.eqI32("A.3: 90 bytes of ServerHello", frame.dataLength, n32(90));
  t.eqStr("A.3: starting with its header", windowHex(server, frame.dataStart, n32(4)), "02000056");
  t.eqI32("A.3: to the end of the payload", frame.end, toI32(server.length));

  // The frame is reused: a later, smaller frame leaves nothing of an earlier one.
  quicParseFrame(frame, fromHex("01"), n32(0), n32(1));
  t.ok(
    "a reused QuicFrame keeps nothing of the frame before",
    frame.type === QUIC_FRAME_PING && frame.dataLength === 0 && frame.ackRangeCount === 0 && frame.end === 1
  );
};

/** ACK and ACK_ECN, written from ranges and read back. */
const ackChecks = (t: Suite): void => {
  const ranges: i64[] = [n64(10), n64(12), n64(5), n64(7), n64(0), n64(2)];
  const out: u8[] = [];
  t.ok("quicPushAck writes three ranges", quicPushAck(out, ranges, n32(3), n64(9)));
  t.eqStr("as largest 12, delay 9, two more ranges, first 2, gap 1 length 2, gap 1 length 2", toHex(out), "020c0902020102010" + "2");
  const frame: QuicFrame = frameOf(toHex(out));
  t.ok("and reads back as written", frame.largest === n64(12) && frame.ackDelay === n64(9) && frame.ackRangeCount === 3);
  t.ok(
    "with every range",
    frame.ackRanges[0] === n64(10) &&
      frame.ackRanges[1] === n64(12) &&
      frame.ackRanges[2] === n64(5) &&
      frame.ackRanges[3] === n64(7) &&
      frame.ackRanges[4] === n64(0) &&
      frame.ackRanges[5] === n64(2)
  );
  const ecn: QuicFrame = frameOf("030c0000020102" + "03");
  t.ok("ACK_ECN reads its three counts", ecn.type === QUIC_FRAME_ACK_ECN && ecn.ect0 === n64(1) && ecn.ect1 === n64(2) && ecn.ce === n64(3));
  t.eqI64("an ACK_ECN cut inside its counts is FRAME_ENCODING_ERROR", errorOf("030c00000201"), QUIC_ERROR_FRAME_ENCODING);

  // Forty one-number ranges, every other packet: all are checked, 32 are kept.
  const many: i64[] = [];
  for (let k: i32 = 39; k >= 0; k--) {
    many.push(toI64(k) * 2);
    many.push(toI64(k) * 2);
  }
  const wide: u8[] = [];
  t.ok("quicPushAck writes forty ranges", quicPushAck(wide, many, n32(40), n64(0)));
  const kept: QuicFrame = frameOf(toHex(wide));
  t.ok(
    "a frame of forty ranges keeps the first QUIC_FRAME_MAX_ACK_RANGES and counts them all",
    kept.ackRangeCount === QUIC_FRAME_MAX_ACK_RANGES && kept.ackRangeTotal === n64(40) && kept.largest === n64(78)
  );

  const none: u8[] = [];
  t.ok("no ranges are refused", !quicPushAck(none, ranges, n32(0), n64(0)));
  t.ok("more ranges than the array holds are refused", !quicPushAck(none, ranges, n32(4), n64(0)));
  t.ok("a delay no varint holds is refused", !quicPushAck(none, ranges, n32(1), n64(-1)));
  t.ok("touching ranges are refused", !quicPushAck(none, [n64(5), n64(9), n64(3), n64(4)], n32(2), n64(0)));
  t.ok("a range whose smallest passes its largest is refused", !quicPushAck(none, [n64(9), n64(5)], n32(1), n64(0)));
  t.eqI32("and nothing was appended", toI32(none.length), n32(0));

  t.eqI64("an ACK cut inside its fields is FRAME_ENCODING_ERROR", errorOf("020c00"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a first range below packet 0 is FRAME_ENCODING_ERROR", errorOf("0205000006"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a gap below packet 0 is FRAME_ENCODING_ERROR", errorOf("020500010006" + "00"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a range length below packet 0 is FRAME_ENCODING_ERROR", errorOf("02050001000004"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a range count the frame does not carry is FRAME_ENCODING_ERROR", errorOf("0205000500"), QUIC_ERROR_FRAME_ENCODING);
};

/** CRYPTO and STREAM, the frames that carry data. */
const dataChecks = (t: Suite): void => {
  const data: u8[] = fromHex("00112233445566778899");
  const crypto: u8[] = [];
  t.ok("quicPushCrypto writes a window", quicPushCrypto(crypto, n64(1000), data, n32(2), n32(5)));
  t.eqStr("as type, offset 1000, length 5 and the bytes", toHex(crypto), "0643e8052233445566");
  t.eqI32("quicCryptoOverhead is its header's size", quicCryptoOverhead(n64(1000), n32(5)), n32(4));
  const c: QuicFrame = frameOf(toHex(crypto));
  t.ok("it reads back", c.type === QUIC_FRAME_CRYPTO && c.offset === n64(1000) && c.dataStart === 4 && c.dataLength === 5);
  const refused: u8[] = [];
  t.ok("a window past the data is refused", !quicPushCrypto(refused, n64(0), data, n32(8), n32(5)));
  t.ok("an end past 2^62 - 1 is refused", !quicPushCrypto(refused, MAX_VARINT, data, n32(0), n32(1)));
  t.eqI64("a CRYPTO length past the packet is FRAME_ENCODING_ERROR", errorOf("06000500"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a CRYPTO cut inside its offset is FRAME_ENCODING_ERROR", errorOf("0640"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64(
    "a CRYPTO frame reaching past 2^62 - 1 is FRAME_ENCODING_ERROR",
    errorOf("06ffffffffffffffff0100"),
    QUIC_ERROR_FRAME_ENCODING
  );

  const first: u8[] = [];
  t.ok("quicPushStream writes stream 4 from offset 0 with FIN", quicPushStream(first, n64(4), n64(0), data, n32(0), n32(3), true));
  t.eqStr("as type 0x0b (LEN and FIN, no OFF), the ID, the length and the bytes", toHex(first), "0b0403001122");
  t.eqI32("quicStreamOverhead leaves out a zero offset", quicStreamOverhead(n64(4), n64(0), n32(3)), n32(3));
  const s: QuicFrame = frameOf(toHex(first));
  t.ok("it reads back", s.type === QUIC_FRAME_STREAM && s.streamId === n64(4) && s.offset === n64(0) && s.fin && s.dataLength === 3);
  const later: u8[] = [];
  t.ok("and from offset 300 without FIN", quicPushStream(later, n64(8), n64(300), data, n32(3), n32(2), false));
  t.eqStr("as type 0x0e (OFF and LEN)", toHex(later), "0e08412c023344");
  t.eqI32("quicStreamOverhead counts the offset", quicStreamOverhead(n64(8), n64(300), n32(2)), n32(5));
  const l: QuicFrame = frameOf(toHex(later));
  t.ok("it reads back", l.streamId === n64(8) && l.offset === n64(300) && !l.fin && l.dataStart === 5);
  const toEnd: QuicFrame = frameOf("0d00057778");
  t.ok("a STREAM frame without LEN runs to the end of the packet", toEnd.offset === n64(5) && toEnd.dataLength === 2 && toEnd.fin);
  t.ok("a stream ID no varint holds is refused", !quicPushStream(refused, n64(-1), n64(0), data, n32(0), n32(1), false));
  t.ok("a STREAM window past the data is refused", !quicPushStream(refused, n64(0), n64(0), data, n32(9), n32(2), false));
  t.ok("a STREAM end past 2^62 - 1 is refused", !quicPushStream(refused, n64(0), MAX_VARINT, data, n32(0), n32(1), false));
  t.eqI32("nothing was appended", toI32(refused.length), n32(0));
  t.eqI64("a STREAM frame cut inside its ID is FRAME_ENCODING_ERROR", errorOf("0a40"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a STREAM length past the packet is FRAME_ENCODING_ERROR", errorOf("0a000300"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64(
    "a STREAM frame reaching past 2^62 - 1 is FRAME_ENCODING_ERROR",
    errorOf("0e00ffffffffffffffff0100"),
    QUIC_ERROR_FRAME_ENCODING
  );
};

/** The frames of one or two varints: limits, blocked notices, retirement, and the stream errors. */
const valueChecks = (t: Suite): void => {
  const types: i32[] = [
    QUIC_FRAME_MAX_DATA,
    QUIC_FRAME_MAX_STREAMS_BIDI,
    QUIC_FRAME_MAX_STREAMS_UNI,
    QUIC_FRAME_DATA_BLOCKED,
    QUIC_FRAME_STREAMS_BLOCKED_BIDI,
    QUIC_FRAME_STREAMS_BLOCKED_UNI,
    QUIC_FRAME_RETIRE_CONNECTION_ID,
  ];
  const all: u8[] = [];
  let read: boolean = true;
  for (const type of types) {
    const one: u8[] = [];
    read = read && quicPushValue(one, type, n64(70000));
    const f: QuicFrame = frameOf(toHex(one));
    read = read && f.type === type && f.value === n64(70000) && f.end === 5;
    for (const b of one) {
      all.push(b);
    }
  }
  t.ok("each one-value frame writes and reads back 70000", read);
  t.eqStr("as type then a four-byte varint", toHex(all).substring(0, 20), "1080011170" + "1280011170");
  const refused: u8[] = [];
  t.ok("quicPushValue refuses a type that is not one-value", !quicPushValue(refused, QUIC_FRAME_PING, n64(1)));
  t.ok("and a value no varint holds", !quicPushValue(refused, QUIC_FRAME_MAX_DATA, n64(-1)));
  t.ok("and a stream count past 2^60", !quicPushValue(refused, QUIC_FRAME_MAX_STREAMS_BIDI, MAX_VARINT));
  t.eqI64("a MAX_STREAMS past 2^60 is FRAME_ENCODING_ERROR", errorOf("12d000000000000001"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a STREAMS_BLOCKED cut short is FRAME_ENCODING_ERROR", errorOf("1640"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a MAX_DATA cut short is FRAME_ENCODING_ERROR", errorOf("1040"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a DATA_BLOCKED cut short is FRAME_ENCODING_ERROR", errorOf("1440"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a RETIRE_CONNECTION_ID cut short is FRAME_ENCODING_ERROR", errorOf("1940"), QUIC_ERROR_FRAME_ENCODING);

  const sv: u8[] = [];
  t.ok("quicPushStreamValue writes MAX_STREAM_DATA", quicPushStreamValue(sv, QUIC_FRAME_MAX_STREAM_DATA, n64(4), n64(100)));
  t.ok("and STREAM_DATA_BLOCKED", quicPushStreamValue(sv, QUIC_FRAME_STREAM_DATA_BLOCKED, n64(8), n64(5)));
  t.eqStr("both", toHex(sv), "110440641508" + "05");
  const msd: QuicFrame = frameOf("11044064");
  t.ok("MAX_STREAM_DATA reads back", msd.type === QUIC_FRAME_MAX_STREAM_DATA && msd.streamId === n64(4) && msd.value === n64(100));
  t.ok("quicPushStreamValue refuses another type", !quicPushStreamValue(refused, QUIC_FRAME_MAX_DATA, n64(0), n64(0)));
  t.ok("and a value no varint holds", !quicPushStreamValue(refused, QUIC_FRAME_MAX_STREAM_DATA, n64(0), n64(-1)));
  t.eqI64("a MAX_STREAM_DATA cut short is FRAME_ENCODING_ERROR", errorOf("1104"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a STREAM_DATA_BLOCKED cut short is FRAME_ENCODING_ERROR", errorOf("1504"), QUIC_ERROR_FRAME_ENCODING);

  const se: u8[] = [];
  t.ok("quicPushStreamError writes RESET_STREAM", quicPushStreamError(se, n64(4), n64(7), n64(12)));
  t.ok("and, with final size -1, STOP_SENDING", quicPushStreamError(se, n64(4), n64(7), n64(-1)));
  t.eqStr("both", toHex(se), "040407" + "0c050407");
  const reset: QuicFrame = frameOf("0404070c");
  t.ok("RESET_STREAM reads back", reset.type === QUIC_FRAME_RESET_STREAM && reset.errorCode === n64(7) && reset.value === n64(12));
  const stop: QuicFrame = frameOf("050407");
  t.ok("STOP_SENDING reads back", stop.type === QUIC_FRAME_STOP_SENDING && stop.streamId === n64(4) && stop.errorCode === n64(7));
  t.ok("quicPushStreamError refuses a value no varint holds", !quicPushStreamError(refused, n64(-1), n64(0), n64(0)));
  t.eqI64("a RESET_STREAM cut short is FRAME_ENCODING_ERROR", errorOf("040407"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a STOP_SENDING cut short is FRAME_ENCODING_ERROR", errorOf("0504"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI32("no refused write appended anything", toI32(refused.length), n32(0));
};

/** The frames that carry IDs, tokens and phrases. */
const otherChecks = (t: Suite): void => {
  const cid: u8[] = fromHex("0102030405060708");
  const token: u8[] = fromHex("a0a1a2a3a4a5a6a7a8a9aaabacadaeaf");
  const ncid: u8[] = [];
  t.ok("quicPushNewConnectionId writes one", quicPushNewConnectionId(ncid, n64(3), n64(1), cid, token));
  t.eqStr("as sequence, Retire Prior To, the ID's length and bytes, and the token", toHex(ncid), "1803010801020304050607" + "08a0a1a2a3a4a5a6a7a8a9aaabacadaeaf");
  const f: QuicFrame = frameOf(toHex(ncid));
  t.ok(
    "it reads back",
    f.type === QUIC_FRAME_NEW_CONNECTION_ID && f.value === n64(3) && f.retirePriorTo === n64(1) && toHex(ncid).substring(8, 24) === "0102030405060708"
  );
  t.ok(
    "with the ID and the token left in the payload, as windows",
    f.connectionIdStart === n32(4) && f.connectionIdLength === n32(8) && f.resetTokenStart === n32(12) && toHex(ncid).substring(24) === toHex(token)
  );
  const refused: u8[] = [];
  const none: u8[] = [];
  t.ok("an empty connection ID is refused", !quicPushNewConnectionId(refused, n64(1), n64(0), none, token));
  t.ok("so is one of 21 bytes", !quicPushNewConnectionId(refused, n64(1), n64(0), new Array<u8>(21), token));
  t.ok("so is a 15-byte token", !quicPushNewConnectionId(refused, n64(1), n64(0), cid, new Array<u8>(15)));
  t.ok("so is a Retire Prior To above the sequence number", !quicPushNewConnectionId(refused, n64(1), n64(2), cid, token));
  const tail: string = "a0a1a2a3a4a5a6a7a8a9aaabacadaeaf";
  t.eqI64("a NEW_CONNECTION_ID with an empty ID is FRAME_ENCODING_ERROR", errorOf("180100" + "00" + tail), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64(
    "one with a 21-byte ID is FRAME_ENCODING_ERROR",
    errorOf("180100" + "15" + "000000000000000000000000000000000000000000" + tail),
    QUIC_ERROR_FRAME_ENCODING
  );
  t.eqI64("one whose Retire Prior To passes its sequence number is FRAME_ENCODING_ERROR", errorOf("180102" + "0101" + tail), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("one cut inside its token is FRAME_ENCODING_ERROR", errorOf("1801000101a0a1"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("one cut before its ID's length is FRAME_ENCODING_ERROR", errorOf("180100"), QUIC_ERROR_FRAME_ENCODING);

  const path: u8[] = [];
  t.ok("quicPushPathData writes PATH_CHALLENGE", quicPushPathData(path, QUIC_FRAME_PATH_CHALLENGE, cid, n32(0)));
  t.ok("and PATH_RESPONSE", quicPushPathData(path, QUIC_FRAME_PATH_RESPONSE, cid, n32(0)));
  t.eqStr("each the type and eight bytes", toHex(path), "1a0102030405060708" + "1b0102030405060708");
  const challenge: QuicFrame = frameOf("1a0102030405060708");
  t.ok("PATH_CHALLENGE reads back", challenge.type === QUIC_FRAME_PATH_CHALLENGE && challenge.dataStart === 1 && challenge.dataLength === 8);
  t.ok("quicPushPathData refuses another type", !quicPushPathData(refused, QUIC_FRAME_PING, cid, n32(0)));
  t.ok("and a window past the data", !quicPushPathData(refused, QUIC_FRAME_PATH_RESPONSE, cid, n32(1)));
  t.eqI64("a PATH_CHALLENGE cut short is FRAME_ENCODING_ERROR", errorOf("1a01020304050607"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a PATH_RESPONSE cut short is FRAME_ENCODING_ERROR", errorOf("1b01"), QUIC_ERROR_FRAME_ENCODING);

  const close: u8[] = [];
  const reason: u8[] = fromHex("6f6f7073");
  t.ok("quicPushConnectionClose writes the transport form", quicPushConnectionClose(close, false, n64(10), n64(6), reason));
  t.ok("and the application form", quicPushConnectionClose(close, true, n64(300), n64(6), reason));
  t.eqStr("0x1c with the frame type, 0x1d without", toHex(close), "1c0a06046f6f7073" + "1d412c046f6f7073");
  const transport: QuicFrame = frameOf("1c0a06046f6f7073");
  t.ok(
    "the transport form reads back",
    transport.type === QUIC_FRAME_CONNECTION_CLOSE && transport.errorCode === n64(10) && transport.frameType === n64(6) && transport.dataLength === 4
  );
  const app: QuicFrame = frameOf("1d412c046f6f7073");
  t.ok("the application form reads back", app.type === QUIC_FRAME_CONNECTION_CLOSE_APP && app.errorCode === n64(300) && app.dataStart === 4);
  t.ok("quicPushConnectionClose refuses a code no varint holds", !quicPushConnectionClose(refused, false, n64(-1), n64(0), reason));
  t.eqI64("a CONNECTION_CLOSE whose reason runs past the packet is FRAME_ENCODING_ERROR", errorOf("1c0a00056f6f7073"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("so is an application close's", errorOf("1d0a056f6f7073"), QUIC_ERROR_FRAME_ENCODING);

  const nt: u8[] = [];
  t.ok("quicPushNewToken writes a token", quicPushNewToken(nt, cid));
  t.eqStr("behind its length", toHex(nt), "07080102030405060708");
  const tok: QuicFrame = frameOf(toHex(nt));
  t.ok("it reads back", tok.type === QUIC_FRAME_NEW_TOKEN && tok.dataStart === 2 && tok.dataLength === 8);
  t.ok("an empty token is refused", !quicPushNewToken(refused, none));
  t.eqI64("an empty NEW_TOKEN is FRAME_ENCODING_ERROR (RFC 9000 §19.7)", errorOf("0700"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a NEW_TOKEN cut short is FRAME_ENCODING_ERROR", errorOf("070801"), QUIC_ERROR_FRAME_ENCODING);

  const typeOnly: u8[] = [];
  t.ok("quicPushTypeOnly writes PING", quicPushTypeOnly(typeOnly, QUIC_FRAME_PING));
  t.ok("and HANDSHAKE_DONE", quicPushTypeOnly(typeOnly, QUIC_FRAME_HANDSHAKE_DONE));
  t.eqStr("one byte each", toHex(typeOnly), "011e");
  t.eqI32("HANDSHAKE_DONE reads back", frameOf("1e").type, QUIC_FRAME_HANDSHAKE_DONE);
  t.ok("quicPushTypeOnly refuses a frame with a body", !quicPushTypeOnly(refused, QUIC_FRAME_ACK));
  quicPushPadding(refused, n32(0));
  t.eqI32("padding of zero bytes appends nothing, and no refused write appended anything", toI32(refused.length), n32(0));
};

/** The parse's own refusals, and the tables of §12.4 and §13.2. */
const parseChecks = (t: Suite): void => {
  const bytes: u8[] = fromHex("01");
  const frame = new QuicFrame();
  t.eqI64("a window starting before the payload is INTERNAL_ERROR", quicParseFrame(frame, bytes, n32(-1), n32(1)), QUIC_ERROR_INTERNAL);
  t.eqI64("one ending past it is INTERNAL_ERROR", quicParseFrame(frame, bytes, n32(0), n32(2)), QUIC_ERROR_INTERNAL);
  t.eqI64("an empty window is INTERNAL_ERROR", quicParseFrame(frame, bytes, n32(1), n32(1)), QUIC_ERROR_INTERNAL);
  t.eqI64("frame type 0x1f, past RFC 9000's, is FRAME_ENCODING_ERROR", errorOf("1f"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("a frame type cut inside its varint is FRAME_ENCODING_ERROR", errorOf("40"), QUIC_ERROR_FRAME_ENCODING);
  t.eqI64("PING spelled in two bytes is PROTOCOL_VIOLATION (§12.4)", errorOf("4001"), QUIC_ERROR_PROTOCOL_VIOLATION);
  t.eqI64("a large frame type is FRAME_ENCODING_ERROR", errorOf("80001000"), QUIC_ERROR_FRAME_ENCODING);

  const handshakeOnly: i32[] = [QUIC_FRAME_PADDING, QUIC_FRAME_PING, QUIC_FRAME_ACK, QUIC_FRAME_ACK_ECN, QUIC_FRAME_CRYPTO, QUIC_FRAME_CONNECTION_CLOSE];
  let longOk: boolean = true;
  for (const type of handshakeOnly) {
    longOk = longOk && quicFrameAllowed(type, QUIC_PACKET_INITIAL) && quicFrameAllowed(type, QUIC_PACKET_HANDSHAKE);
  }
  t.ok("Initial and Handshake packets carry PADDING, PING, ACK, CRYPTO and the transport close", longOk);
  t.ok(
    "but not STREAM, the application close, HANDSHAKE_DONE or NEW_TOKEN",
    !quicFrameAllowed(QUIC_FRAME_STREAM, QUIC_PACKET_INITIAL) &&
      !quicFrameAllowed(QUIC_FRAME_CONNECTION_CLOSE_APP, QUIC_PACKET_HANDSHAKE) &&
      !quicFrameAllowed(QUIC_FRAME_HANDSHAKE_DONE, QUIC_PACKET_INITIAL) &&
      !quicFrameAllowed(QUIC_FRAME_NEW_TOKEN, QUIC_PACKET_HANDSHAKE)
  );
  t.ok("a 1-RTT packet carries anything", quicFrameAllowed(QUIC_FRAME_HANDSHAKE_DONE, QUIC_PACKET_SHORT) && quicFrameAllowed(QUIC_FRAME_CRYPTO, QUIC_PACKET_SHORT));
  t.ok(
    "a 0-RTT packet carries STREAM but not ACK, CRYPTO or HANDSHAKE_DONE",
    quicFrameAllowed(QUIC_FRAME_STREAM, QUIC_PACKET_ZERO_RTT) &&
      !quicFrameAllowed(QUIC_FRAME_ACK, QUIC_PACKET_ZERO_RTT) &&
      !quicFrameAllowed(QUIC_FRAME_CRYPTO, QUIC_PACKET_ZERO_RTT) &&
      !quicFrameAllowed(QUIC_FRAME_HANDSHAKE_DONE, QUIC_PACKET_ZERO_RTT)
  );
  t.ok("a Retry carries no frames", !quicFrameAllowed(QUIC_FRAME_PADDING, QUIC_PACKET_RETRY));
  t.ok(
    "ACK, PADDING and both closes do not elicit an acknowledgement",
    !quicFrameAckEliciting(QUIC_FRAME_ACK) &&
      !quicFrameAckEliciting(QUIC_FRAME_ACK_ECN) &&
      !quicFrameAckEliciting(QUIC_FRAME_PADDING) &&
      !quicFrameAckEliciting(QUIC_FRAME_CONNECTION_CLOSE) &&
      !quicFrameAckEliciting(QUIC_FRAME_CONNECTION_CLOSE_APP)
  );
  t.ok("PING and STREAM do", quicFrameAckEliciting(QUIC_FRAME_PING) && quicFrameAckEliciting(QUIC_FRAME_STREAM));
};

/** Runs every check and answers the exit code. */
export const quicFrameChecks = (): i32 => {
  const t = new Suite("quic frames");
  rfcChecks(t);
  ackChecks(t);
  dataChecks(t);
  valueChecks(t);
  otherChecks(t);
  parseChecks(t);
  inPlaceChecks(t);
  return t.done();
};

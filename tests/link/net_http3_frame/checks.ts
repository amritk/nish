// `nish/net/http3-frame` against frames built by hand. RFC 9114 has no
// appendix of test vectors, so every frame here is written out byte by byte
// from the layouts of §7.1 and §7.2 (and the stream types of §6.2), each
// varint by RFC 9000 §16's table, and each is read from its bytes and written
// back to the same bytes; then every refusal a reader owes. The checks live
// here so that `tests/link/net_http3_frame_f64` runs every one again under
// `--number-mode f64`.
import { Suite } from "nish/testing";
import {
  H3_CLOSED_CRITICAL_STREAM,
  H3_CONNECT_ERROR,
  H3_EXCESSIVE_LOAD,
  H3_FRAME_CANCEL_PUSH,
  H3_FRAME_DATA,
  H3_FRAME_ERROR,
  H3_FRAME_GOAWAY,
  H3_FRAME_HEADER_MAX,
  H3_FRAME_HEADERS,
  H3_FRAME_MAX_PUSH_ID,
  H3_FRAME_PUSH_PROMISE,
  H3_FRAME_SETTINGS,
  H3_FRAME_UNEXPECTED,
  H3_GENERAL_PROTOCOL_ERROR,
  H3_ID_ERROR,
  H3_INTERNAL_ERROR,
  H3_MESSAGE_ERROR,
  H3_MISSING_SETTINGS,
  H3_NO_ERROR,
  H3_REQUEST_CANCELLED,
  H3_REQUEST_INCOMPLETE,
  H3_REQUEST_REJECTED,
  H3_SETTINGS_ERROR,
  H3_SETTINGS_KEEP,
  H3_SETTINGS_MAX_FIELD_SECTION_SIZE,
  H3_SETTINGS_OK,
  H3_SETTINGS_QPACK_BLOCKED_STREAMS,
  H3_SETTINGS_QPACK_MAX_TABLE_CAPACITY,
  H3_STREAM_CONTROL,
  H3_STREAM_CREATION_ERROR,
  H3_STREAM_PUSH,
  H3_STREAM_QPACK_DECODER,
  H3_STREAM_QPACK_ENCODER,
  H3_VERSION_FALLBACK,
  Http3FrameHeader,
  Http3Settings,
  h3FrameHeaderSize,
  h3Greased,
  h3PutFrameHeader,
  h3PutIdFrame,
  h3PutSettings,
  h3PutVarint,
  h3ReadFrameHeader,
  h3ReadIdPayload,
  h3ReadSettings,
  h3ReadVarint,
  h3ReservedHttp2Frame,
  h3VarintLength,
} from "nish/net/http3-frame";
import { QUIC_MAX_VARINT } from "nish/net/quic-packet";
import { fromHex, toHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";

/** `buf[0 .. n)` in hex, or `refused` for a writer's -1. */
const written = (buf: u8[], n: i32): string => {
  if (n < 0) {
    return "refused";
  }
  const out: u8[] = [];
  for (let k: i32 = 0; k < n && k < toI32(buf.length); k++) {
    out.push(buf[k]);
  }
  return toHex(out);
};

/** The header `hex` holds as `type length size`, or `short` when the bytes end inside it. */
const header = (hex: string): string => {
  const h = new Http3FrameHeader();
  const bytes: u8[] = fromHex(hex);
  const n: i32 = h3ReadFrameHeader(h, bytes, n32(0), toI32(bytes.length));
  return n === 0 ? "short" : `${h.type} ${h.length} ${n}`;
};

/** Every frame type from its bytes and back to them. */
const frames = (t: Suite): void => {
  const out: u8[] = new Array<u8>(64);
  // §7.2.1: DATA, type 0x00, a one-byte length, five bytes of content.
  t.eqStr("DATA: 00 05, then its five bytes", header("000568656c6c6f"), "0 5 2");
  t.eqStr("written back", written(out, h3PutFrameHeader(out, n32(0), n32(64), H3_FRAME_DATA, n64(5))), "0005");
  // §7.2.2: HEADERS of 300 bytes, whose length takes the two-byte varint 0x412c.
  t.eqStr("HEADERS of 300 bytes: 01 41 2c", header("01412c"), "1 300 3");
  t.eqStr("written back", written(out, h3PutFrameHeader(out, n32(0), n32(64), H3_FRAME_HEADERS, n64(300))), "01412c");
  // §7.2.3: CANCEL_PUSH of push ID 7.
  t.eqStr("CANCEL_PUSH of push ID 7: 03 01 07", header("030107"), "3 1 2");
  t.eqI64("its payload is the one push ID", h3ReadIdPayload(fromHex("07"), n32(0), n32(1)), n64(7));
  t.eqStr("written back", written(out, h3PutIdFrame(out, n32(0), n32(64), H3_FRAME_CANCEL_PUSH, n64(7))), "030107");
  // §7.2.4: SETTINGS of QPACK_MAX_TABLE_CAPACITY 0, QPACK_BLOCKED_STREAMS 0
  // and MAX_FIELD_SECTION_SIZE 16,384, whose value takes the four-byte varint 0x80004000.
  const settings: string = "0409010007000680004000";
  t.eqStr("SETTINGS of three pairs: 04 09, then 01 00, 07 00, 06 80 00 40 00", header(settings), "4 9 2");
  const s = new Http3Settings();
  const bytes: u8[] = fromHex(settings);
  t.eqI64("read whole", h3ReadSettings(s, bytes, n32(2), n32(9)), H3_SETTINGS_OK);
  t.ok("as capacity 0, no blocked streams, a field section of 16,384", s.maxTableCapacity === n64(0) && s.blockedStreams === n64(0) && s.maxFieldSectionSize === n64(16384) && s.seen === n32(7));
  const ids: i64[] = [H3_SETTINGS_QPACK_MAX_TABLE_CAPACITY, H3_SETTINGS_QPACK_BLOCKED_STREAMS, H3_SETTINGS_MAX_FIELD_SECTION_SIZE];
  const values: i64[] = [n64(0), n64(0), n64(16384)];
  t.eqStr("written back", written(out, h3PutSettings(out, n32(0), n32(64), ids, values)), settings);
  const none: i64[] = [];
  t.eqStr("an empty SETTINGS is 04 00", written(out, h3PutSettings(out, n32(0), n32(64), none, none)), "0400");
  t.eqI64("and reads as the defaults: the field section unlimited (§7.2.4.1)", h3ReadSettings(s, out, n32(2), n32(0)) + s.maxFieldSectionSize, n64(-1));
  // §7.2.5: PUSH_PROMISE of push ID 2 and the field section 00 00 d1 (`:method GET`, static index 17).
  t.eqStr("PUSH_PROMISE: 05 04, push ID 2, then a field section", header("0504020000d1"), "5 4 2");
  const promise: u8[] = fromHex("020000d1");
  t.ok("whose push ID is the payload's first varint, the section after it", h3ReadVarint(promise, n32(0), n32(4)) === n64(2) && h3VarintLength(promise, n32(0)) === n32(1));
  // §7.2.6: GOAWAY naming stream 4.
  t.eqStr("GOAWAY of stream 4: 07 01 04", header("070104"), "7 1 2");
  t.eqStr("written back", written(out, h3PutIdFrame(out, n32(0), n32(64), H3_FRAME_GOAWAY, n64(4))), "070104");
  // §7.2.7: MAX_PUSH_ID of 10.
  t.eqStr("MAX_PUSH_ID of 10: 0d 01 0a", header("0d010a"), "13 1 2");
  t.eqStr("written back", written(out, h3PutIdFrame(out, n32(0), n32(64), H3_FRAME_MAX_PUSH_ID, n64(10))), "0d010a");
  // §7.2.8: a reserved type, 0x1f * 1,000,000 + 0x21 = 31,000,033, a four-byte varint.
  t.eqStr("a reserved type 0x1f * N + 0x21 reads like any other: 81 d9 05 e1, length 0", header("81d905e100"), "31000033 0 5");
  t.ok("and is a greased value", h3Greased(n64(31000033)) && h3Greased(n64(0x21)) && h3Greased(n64(0x40)));
  t.ok("as 0x20, 0x22 and 0x3f are not", !h3Greased(n64(0x20)) && !h3Greased(n64(0x22)) && !h3Greased(n64(0x3f)));
  t.eqStr("an eight-byte length is a header too: 2^62 - 1", header("00ffffffffffffffff"), "0 4611686018427387903 9");
  t.eqI32("the largest header is two eight-byte varints", h3FrameHeaderSize(QUIC_MAX_VARINT, QUIC_MAX_VARINT), H3_FRAME_HEADER_MAX);
};

/** A header read before it is all there, and every writer's refusal. */
const pieces = (t: Suite): void => {
  const h = new Http3FrameHeader();
  const bytes: u8[] = fromHex("81d905e1412c");
  let short: boolean = true;
  for (let n: i32 = 0; n < 6; n++) {
    short = short && h3ReadFrameHeader(h, bytes, n32(0), n) === 0;
  }
  t.ok("a header cut at any of its first five bytes is not a header yet", short);
  t.eqI32("and is one at the sixth", h3ReadFrameHeader(h, bytes, n32(0), n32(6)), n32(6));
  t.eqI32("read from the middle of a buffer", h3ReadFrameHeader(h, fromHex("ffff0005"), n32(2), n32(2)), n32(2));
  const out: u8[] = new Array<u8>(8);
  t.eqI32("a header written at an offset answers where its payload goes", h3PutFrameHeader(out, n32(5), n32(8), H3_FRAME_DATA, n64(300)), n32(8));
  t.eqI32("one byte short of room is refused", h3PutFrameHeader(out, n32(6), n32(8), H3_FRAME_DATA, n64(300)), n32(-1));
  t.eqI32("so is an end past the buffer", h3PutFrameHeader(out, n32(0), n32(9), H3_FRAME_DATA, n64(1)), n32(-1));
  t.eqI32("and a length no varint holds", h3PutFrameHeader(out, n32(0), n32(8), H3_FRAME_DATA, QUIC_MAX_VARINT + n64(1)), n32(-1));
  t.eqI32("whose header size is 0", h3FrameHeaderSize(H3_FRAME_DATA, n64(-1)), n32(0));
  t.eqI32("a varint with no room", h3PutVarint(out, n32(7), n32(8), n64(64)), n32(-1));
  t.eqI32("or written backwards", h3PutVarint(out, n32(5), n32(4), n64(1)), n32(-1));
  t.eqI32("an identifier frame with no room", h3PutIdFrame(out, n32(6), n32(8), H3_FRAME_GOAWAY, n64(4)), n32(-1));
  t.eqI32("or an identifier no varint holds", h3PutIdFrame(out, n32(0), n32(8), H3_FRAME_GOAWAY, n64(-1)), n32(-1));
  const ids: i64[] = [n64(1), n64(6)];
  const one: i64[] = [n64(0)];
  t.eqI32("SETTINGS with more identifiers than values", h3PutSettings(out, n32(0), n32(8), ids, one), n32(-1));
  t.eqI32("with a value no varint holds", h3PutSettings(out, n32(0), n32(8), one, [n64(-1)]), n32(-1));
  t.eqI32("or without the room for its payload", h3PutSettings(out, n32(0), n32(8), ids, [n64(0), n64(16384)]), n32(-1));
  t.eqI64("an identifier payload with a byte after its varint: -1, H3_FRAME_ERROR's case", h3ReadIdPayload(fromHex("0400"), n32(0), n32(2)), n64(-1));
  t.eqI64("one that ends inside it", h3ReadIdPayload(fromHex("4004"), n32(0), n32(1)), n64(-1));
  t.eqI64("and an empty one", h3ReadIdPayload(fromHex("04"), n32(0), n32(0)), n64(-1));
  t.eqI64("a two-byte identifier", h3ReadIdPayload(fromHex("4104"), n32(0), n32(2)), n64(260));
};

/** What SETTINGS refuses, and what it keeps (§7.2.4, §7.2.4.1). */
const settingsRules = (t: Suite): void => {
  const s = new Http3Settings();
  t.eqI64("the same identifier twice: H3_SETTINGS_ERROR", h3ReadSettings(s, fromHex("06010602"), n32(0), n32(4)), H3_SETTINGS_ERROR);
  let reserved: boolean = true;
  for (const id of ["00", "02", "03", "04", "05"]) {
    reserved = reserved && h3ReadSettings(s, fromHex(`${id}00`), n32(0), n32(2)) === H3_SETTINGS_ERROR;
  }
  t.ok("an identifier HTTP/2 used with no HTTP/3 setting — 0x00, 0x02 to 0x05 — is H3_SETTINGS_ERROR", reserved);
  t.eqI64("a payload that ends after an identifier: H3_FRAME_ERROR (§7.1)", h3ReadSettings(s, fromHex("06"), n32(0), n32(1)), H3_FRAME_ERROR);
  t.eqI64("one that ends inside a value", h3ReadSettings(s, fromHex("0640"), n32(0), n32(2)), H3_FRAME_ERROR);
  t.eqI64("an unknown identifier is no error", h3ReadSettings(s, fromHex("2105083f"), n32(0), n32(4)), H3_SETTINGS_OK);
  t.ok("and is kept, with its value, for an extension to read", s.unknown(n64(0x21)) === n64(5) && s.unknown(n64(0x08)) === n64(63) && s.unknownCount === n32(2));
  t.eqI64("one it does not have reads as -1", s.unknown(n64(0x33)), n64(-1));
  t.eqI64("an unknown identifier twice, while kept: H3_SETTINGS_ERROR", h3ReadSettings(s, fromHex("21052106"), n32(0), n32(4)), H3_SETTINGS_ERROR);
  // Ten unknown identifiers, 0x40 to 0x49 as two-byte varints: eight kept, two counted.
  const many: u8[] = [];
  for (let k: i32 = 0; k < 10; k++) {
    many.push(toU8(0x40));
    many.push(toU8(0x40 + k));
    many.push(toU8(k));
  }
  t.eqI64("ten unknown identifiers", h3ReadSettings(s, many, n32(0), toI32(many.length)), H3_SETTINGS_OK);
  t.ok("the first H3_SETTINGS_KEEP kept, the rest counted, not compared", s.unknownCount === H3_SETTINGS_KEEP && s.dropped === n32(2) && s.unknown(n64(0x47)) === n64(7) && s.unknown(n64(0x48)) === n64(-1));
  t.ok("a read starts from the defaults", h3ReadSettings(s, many, n32(0), n32(0)) === H3_SETTINGS_OK && s.unknownCount === n32(0) && s.dropped === n32(0));
};

/** The stream types, the reserved frame types and the error codes, against RFC 9114's tables. */
const registry = (t: Suite): void => {
  const out: u8[] = new Array<u8>(4);
  const types: string[] = [];
  for (const type of [H3_STREAM_CONTROL, H3_STREAM_PUSH, H3_STREAM_QPACK_ENCODER, H3_STREAM_QPACK_DECODER]) {
    types.push(written(out, h3PutVarint(out, n32(0), n32(4), type)));
  }
  t.eqStr("the stream types are one byte each: control, push, QPACK encoder, decoder (§6.2, RFC 9204 §4.2)", types.join(" "), "00 01 02 03");
  t.ok("PRIORITY, PING, WINDOW_UPDATE and CONTINUATION are HTTP/2's reserved types (§7.2.8)", h3ReservedHttp2Frame(n64(0x02)) && h3ReservedHttp2Frame(n64(0x06)) && h3ReservedHttp2Frame(n64(0x08)) && h3ReservedHttp2Frame(n64(0x09)));
  t.ok("and no type HTTP/3 defines is", !h3ReservedHttp2Frame(H3_FRAME_DATA) && !h3ReservedHttp2Frame(H3_FRAME_HEADERS) && !h3ReservedHttp2Frame(H3_FRAME_SETTINGS) && !h3ReservedHttp2Frame(H3_FRAME_PUSH_PROMISE) && !h3ReservedHttp2Frame(n64(0x21)));
  const codes: i64[] = [
    H3_NO_ERROR,
    H3_GENERAL_PROTOCOL_ERROR,
    H3_INTERNAL_ERROR,
    H3_STREAM_CREATION_ERROR,
    H3_CLOSED_CRITICAL_STREAM,
    H3_FRAME_UNEXPECTED,
    H3_FRAME_ERROR,
    H3_EXCESSIVE_LOAD,
    H3_ID_ERROR,
    H3_SETTINGS_ERROR,
    H3_MISSING_SETTINGS,
    H3_REQUEST_REJECTED,
    H3_REQUEST_CANCELLED,
    H3_REQUEST_INCOMPLETE,
    H3_MESSAGE_ERROR,
    H3_CONNECT_ERROR,
    H3_VERSION_FALLBACK,
  ];
  let ordered: boolean = true;
  for (let k: i32 = 0; k < toI32(codes.length); k++) {
    ordered = ordered && codes[k] === n64(0x0100) + toI64(k);
  }
  t.ok("the error codes of §8.1 are 0x0100 to 0x0110, in the RFC's order", ordered);
  t.ok("the settings are §7.2.4.1's 0x06 and RFC 9204's 0x01 and 0x07", H3_SETTINGS_MAX_FIELD_SECTION_SIZE === n64(6) && H3_SETTINGS_QPACK_MAX_TABLE_CAPACITY === n64(1) && H3_SETTINGS_QPACK_BLOCKED_STREAMS === n64(7));
};

/** Every check, in one suite. */
export const frameChecks = (): i32 => {
  const t = new Suite("http3 frames");
  frames(t);
  pieces(t);
  settingsRules(t);
  registry(t);
  return t.done();
};

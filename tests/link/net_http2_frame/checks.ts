// `nish/net/http2-frame` against frames built by hand from RFC 9113 §4.1 and
// §6: every one of the ten types read from its bytes and written back to the
// same bytes, then every refusal a reader owes — each connection error and
// each stream error — and the setting values §6.5.2 bounds. The checks live
// here so that `tests/link/net_http2_frame_f64` runs every one again under
// `--number-mode f64`.
import {
  H2_CANCEL,
  H2_COMPRESSION_ERROR,
  H2_CONNECT_ERROR,
  H2_DEFAULT_MAX_FRAME,
  H2_DEFAULT_WINDOW,
  H2_ENHANCE_YOUR_CALM,
  H2_FRAME_HEADER_SIZE,
  H2_FRAME_PRIORITY,
  H2_HTTP_1_1_REQUIRED,
  H2_INADEQUATE_SECURITY,
  H2_INTERNAL_ERROR,
  H2_MAX_WINDOW,
  H2_REFUSED_STREAM,
  H2_SETTING_SIZE,
  H2_SETTINGS_MAX_CONCURRENT_STREAMS,
  H2_SETTINGS_MAX_HEADER_LIST_SIZE,
  H2_SETTINGS_TIMEOUT,
  H2_STREAM_CLOSED,
  H2_FLAG_END_HEADERS,
  H2_FLAG_END_STREAM,
  H2_FLOW_CONTROL_ERROR,
  H2_FRAME_CONTINUATION,
  H2_FRAME_DATA,
  H2_FRAME_SETTINGS,
  H2_FRAME_SIZE_ERROR,
  H2_FLAG_ACK,
  H2_FLAG_PADDED,
  H2_FLAG_PRIORITY,
  H2_MAX_FRAME_LIMIT,
  H2_NO_ERROR,
  H2_PROTOCOL_ERROR,
  H2_SETTINGS_ENABLE_CONNECT_PROTOCOL,
  H2_SETTINGS_ENABLE_PUSH,
  H2_SETTINGS_HEADER_TABLE_SIZE,
  H2_SETTINGS_INITIAL_WINDOW_SIZE,
  H2_SETTINGS_MAX_FRAME_SIZE,
  Http2Frame,
  http2ParseFrame,
  http2ReadHeader,
  http2SettingCount,
  http2SettingError,
  http2SettingId,
  http2SettingValue,
  http2WriteContinuation,
  http2WriteData,
  http2WriteGoaway,
  http2WriteHeader,
  http2WriteHeaders,
  http2WritePing,
  http2WritePriority,
  http2WritePushPromise,
  http2WriteRstStream,
  http2WriteSettings,
  http2WriteSettingsAck,
  http2WriteWindowUpdate,
} from "nish/net/http2-frame";
import { Suite } from "nish/testing";
import { ascii, bytesOf, hexOf } from "../net_hpack/checks";

/** A typed zero for offsets: a bare literal is an `f64` under `--number-mode f64`. */
const ZERO: i32 = 0;

/** No padding, typed. */
const NO_PAD: i32 = -1;

/** The largest 32-bit value: an error code or a setting may be any. */
const U32_MAX: i64 = 4294967295;

/** The largest frame payload most checks read with. */
const MAX: i32 = 16384;

/** `buf[0 .. end)` as hex, or `refused` when a writer answered -1. */
const written = (buf: u8[], end: i32): string => {
  if (end < 0) {
    return "refused";
  }
  const out: u8[] = [];
  for (let k: i32 = 0; k < end && k < toI32(buf.length); k++) {
    out.push(buf[k]);
  }
  return hexOf(out);
};

/** The frame in `hex` read and parsed with a limit of `max`: the parse's answer. */
const parse = (f: Http2Frame, hex: string, max: i32): i32 => {
  const buf: u8[] = bytesOf(hex);
  if (!http2ReadHeader(f, buf, ZERO, toI32(buf.length))) {
    return -100;
  }
  return http2ParseFrame(f, buf, ZERO, max);
};

/** The frame's content window, as hex, out of the buffer `hex` spells. */
const content = (f: Http2Frame, hex: string): string => {
  const buf: u8[] = bytesOf(hex);
  const out: u8[] = [];
  for (let k: i32 = 0; k < f.contentLength && f.contentStart + k < toI32(buf.length); k++) {
    out.push(buf[f.contentStart + k]);
  }
  return hexOf(out);
};

/** A fresh buffer of `n` bytes to write into. */
const space = (n: i32): u8[] => new Array<u8>(n);

/** Runs every check and answers the exit code. */
export const frameChecks = (): i32 => {
  const t = new Suite("http2 frames");
  const f = new Http2Frame();

  // --- the header ---------------------------------------------------------------------
  const short: u8[] = bytesOf("0000080600000000");
  t.ok("eight bytes are not a header yet", !http2ReadHeader(f, short, ZERO, toI32(short.length)));
  const reserved: string = "000000040180000000";
  t.ok("the reserved bit of a stream identifier is dropped (§4.1)", parse(f, reserved, MAX) === H2_NO_ERROR && f.streamId === 0 && f.type === H2_FRAME_SETTINGS && f.has(H2_FLAG_ACK));
  const big: string = "ffffff00000000000161";
  const bigBuf: u8[] = bytesOf(big);
  t.ok("a header is read before its payload is there, so its length is checked first", http2ReadHeader(f, bigBuf, ZERO, toI32(bigBuf.length)) && f.length === H2_MAX_FRAME_LIMIT && f.type === H2_FRAME_DATA && f.streamId === 1);
  const header: u8[] = space(toI32(9 + 0x0102));
  t.ok(
    "http2WriteHeader writes the nine bytes and answers where the payload goes",
    http2WriteHeader(header, ZERO, 0x0102, 0xfa, 0x5a, 0x7fffffff) === 9 && written(header, 9) === "000102fa5a7fffffff"
  );

  // --- DATA (§6.1) ----------------------------------------------------------------------
  const data: string = "00000900090000000103" + "68656c6c6f" + "000000";
  t.eqI32("DATA, END_STREAM and PADDED, parses", parse(f, data, MAX), H2_NO_ERROR);
  t.ok("its content is the five bytes between the Pad Length and three bytes of padding", f.type === H2_FRAME_DATA && f.streamId === 1 && f.has(H2_FLAG_END_STREAM) && f.padLength === 3 && content(f, data) === hexOf(ascii("hello")));
  const out: u8[] = space(64);
  t.eqStr("and writes back to the same bytes", written(out, http2WriteData(out, ZERO, 1, ascii("hello"), ZERO, 5, H2_FLAG_END_STREAM, 3)), data);
  t.eqStr("unpadded DATA from a window of the source", written(out, http2WriteData(out, ZERO, 3, ascii("xhix"), 1, 2, ZERO, NO_PAD)), "0000020000000000036869");
  t.ok("an exactly padded DATA has no content", parse(f, "000003000800000001" + "026162", MAX) === H2_NO_ERROR && f.contentLength === 0);

  // --- HEADERS (§6.2) -------------------------------------------------------------------
  const headers: string = "000007012400000003800000010f8287";
  t.eqI32("HEADERS with PRIORITY and END_HEADERS parses", parse(f, headers, MAX), H2_NO_ERROR);
  t.ok(
    "the priority fields are read — exclusive, on stream 1, weight 16 — and the fragment follows them",
    f.hasPriority && f.exclusive && f.dependency === 1 && f.weight === 16 && f.has(H2_FLAG_PRIORITY) && f.streamError === 0 && content(f, headers) === "8287"
  );
  const headersOut: string = "000003010d00000003008287";
  t.eqStr("HEADERS with END_STREAM, END_HEADERS and a zero-length pad, written", written(out, http2WriteHeaders(out, ZERO, 3, bytesOf("8287"), ZERO, 2, H2_FLAG_END_STREAM | H2_FLAG_END_HEADERS, ZERO)), headersOut);
  t.ok("and read back", parse(f, headersOut, MAX) === H2_NO_ERROR && f.padLength === 0 && content(f, headersOut) === "8287" && !f.hasPriority);
  t.eqStr("a writer never sets PRIORITY, whatever the flags say", written(out, http2WriteHeaders(out, ZERO, 1, bytesOf("82"), ZERO, 1, H2_FLAG_PRIORITY | H2_FLAG_END_HEADERS, NO_PAD)), "000001010400000001" + "82");

  // --- PRIORITY (§6.3) ------------------------------------------------------------------
  const priority: string = "00000502000000000500000003ff";
  t.ok("PRIORITY: stream 5 on 3, not exclusive, weight 256", parse(f, priority, MAX) === H2_NO_ERROR && f.dependency === 3 && !f.exclusive && f.weight === 256);
  t.eqStr("written back", written(out, http2WritePriority(out, ZERO, 5, 3, false, 256)), priority);
  t.eqStr("exclusive, weight 1", written(out, http2WritePriority(out, ZERO, 7, 1, true, 1)), "0000050200000000078000000100");

  // --- RST_STREAM (§6.4) ------------------------------------------------------------------
  const rst: string = "00000403000000000500000008";
  t.ok("RST_STREAM with CANCEL", parse(f, rst, MAX) === H2_NO_ERROR && f.errorCode === toI64(8) && f.streamId === 5);
  t.eqStr("written back", written(out, http2WriteRstStream(out, ZERO, 5, toI64(8))), rst);
  t.ok("an unknown 32-bit code is kept whole", parse(f, "000004030000000001ffffffff", MAX) === H2_NO_ERROR && f.errorCode === U32_MAX);

  // --- SETTINGS (§6.5) ------------------------------------------------------------------
  const settings: string = "00000c040000000000000100001000000200000000";
  t.eqI32("SETTINGS with two settings parses", parse(f, settings, MAX), H2_NO_ERROR);
  const settingsBuf: u8[] = bytesOf(settings);
  t.ok(
    "and reads as HEADER_TABLE_SIZE 4096, ENABLE_PUSH 0",
    http2SettingCount(f) === 2 &&
      http2SettingId(f, settingsBuf, ZERO) === H2_SETTINGS_HEADER_TABLE_SIZE &&
      http2SettingValue(f, settingsBuf, ZERO) === toI64(4096) &&
      http2SettingId(f, settingsBuf, 1) === H2_SETTINGS_ENABLE_PUSH &&
      http2SettingValue(f, settingsBuf, 1) === toI64(0)
  );
  t.eqStr("written back", written(out, http2WriteSettings(out, ZERO, [H2_SETTINGS_HEADER_TABLE_SIZE, H2_SETTINGS_ENABLE_PUSH], [toI64(4096), toI64(0)])), settings);
  t.eqStr("an empty SETTINGS", written(out, http2WriteSettings(out, ZERO, [], [])), "000000040000000000");
  t.eqStr("the acknowledgement", written(out, http2WriteSettingsAck(out, ZERO)), "000000040100000000");
  t.ok("which parses", parse(f, "000000040100000000", MAX) === H2_NO_ERROR && f.has(H2_FLAG_ACK));

  // --- PUSH_PROMISE (§6.6) ----------------------------------------------------------------
  const push: string = "000008050c00000001" + "02" + "00000002" + "82" + "0000";
  t.ok("PUSH_PROMISE, padded, promising stream 2", parse(f, push, MAX) === H2_NO_ERROR && f.promisedId === 2 && f.padLength === 2 && content(f, push) === "82");
  t.eqStr("written back", written(out, http2WritePushPromise(out, ZERO, 1, 2, bytesOf("82"), ZERO, 1, H2_FLAG_END_HEADERS, 2)), push);
  t.eqStr("and unpadded", written(out, http2WritePushPromise(out, ZERO, 1, 4, bytesOf("82"), ZERO, 1, H2_FLAG_END_HEADERS, NO_PAD)), "000005050400000001" + "00000004" + "82");

  // --- PING (§6.7) -------------------------------------------------------------------------
  const ping: string = "0000080600000000000102030405060708";
  t.ok("PING", parse(f, ping, MAX) === H2_NO_ERROR && content(f, ping) === "0102030405060708" && !f.has(H2_FLAG_ACK));
  const opaque: u8[] = bytesOf("ff0102030405060708");
  t.eqStr("written from a window of eight bytes", written(out, http2WritePing(out, ZERO, opaque, 1, false)), ping);
  t.eqStr("and its acknowledgement", written(out, http2WritePing(out, ZERO, opaque, 1, true)), "0000080601000000000102030405060708");

  // --- GOAWAY (§6.8) --------------------------------------------------------------------------
  const goaway: string = "00000c070000000000" + "00000007" + "0000000b" + "63616c6d";
  t.ok("GOAWAY: last stream 7, ENHANCE_YOUR_CALM, debug data", parse(f, goaway, MAX) === H2_NO_ERROR && f.lastStreamId === 7 && f.errorCode === toI64(11) && content(f, goaway) === hexOf(ascii("calm")));
  t.eqStr("written back", written(out, http2WriteGoaway(out, ZERO, 7, toI64(11), ascii("calm"), ZERO, 4)), goaway);

  // --- WINDOW_UPDATE (§6.9) -------------------------------------------------------------------
  const window: string = "000004080000000000ffffffff";
  t.ok("WINDOW_UPDATE: the reserved bit dropped, 2^31 - 1", parse(f, window, MAX) === H2_NO_ERROR && f.increment === 2147483647 && f.streamError === 0);
  t.eqStr("written", written(out, http2WriteWindowUpdate(out, ZERO, 3, 1000)), "000004080000000003000003e8");

  // --- CONTINUATION (§6.10) and an unknown type ---------------------------------------------
  const continuation: string = "000001090400000003" + "84";
  t.ok("CONTINUATION with END_HEADERS", parse(f, continuation, MAX) === H2_NO_ERROR && f.type === H2_FRAME_CONTINUATION && f.has(H2_FLAG_END_HEADERS) && content(f, continuation) === "84");
  t.eqStr("written back", written(out, http2WriteContinuation(out, ZERO, 3, bytesOf("84"), ZERO, 1, H2_FLAG_END_HEADERS | H2_FLAG_PADDED)), continuation);
  t.ok("a type this module does not know parses, to be ignored (§4.1)", parse(f, "000002fa0000000000abcd", MAX) === H2_NO_ERROR && f.type === 0xfa);

  // --- writers that do not fit ------------------------------------------------------------------
  const tight: u8[] = space(16);
  tight.fill(0xee);
  t.ok("a frame that does not fit is refused and the buffer is left alone", http2WritePing(tight, ZERO, opaque, 1, false) === -1 && tight[0] === toU8(0xee));
  t.ok(
    "so for every writer",
    http2WriteData(tight, 8, 1, ascii("hi"), ZERO, 2, ZERO, NO_PAD) === -1 &&
      http2WriteHeaders(tight, 8, 1, ascii("hi"), ZERO, 2, ZERO, NO_PAD) === -1 &&
      http2WritePriority(tight, 8, 1, 3, false, 16) === -1 &&
      http2WriteRstStream(tight, 8, 1, toI64(0)) === -1 &&
      http2WriteSettings(tight, 8, [H2_SETTINGS_ENABLE_PUSH], [toI64(0)]) === -1 &&
      http2WriteSettingsAck(tight, 8) === -1 &&
      http2WritePushPromise(tight, 8, 1, 2, ascii("hi"), ZERO, 2, ZERO, NO_PAD) === -1 &&
      http2WriteGoaway(tight, 8, 1, toI64(0), ascii(""), ZERO, ZERO) === -1 &&
      http2WriteWindowUpdate(tight, 8, 1, 1) === -1 &&
      http2WriteContinuation(tight, 8, 1, ascii("hi"), ZERO, 2, ZERO) === -1 &&
      tight[8] === toU8(0xee)
  );

  // --- connection errors (§4.2, §6) -----------------------------------------------------------------
  const longFrame: u8[] = space(H2_DEFAULT_MAX_FRAME + 10);
  const longEnd: i32 = http2WriteHeader(longFrame, ZERO, H2_DEFAULT_MAX_FRAME + 1, H2_FRAME_DATA, ZERO, 1);
  http2ReadHeader(f, longFrame, ZERO, toI32(longFrame.length));
  t.ok("a frame past SETTINGS_MAX_FRAME_SIZE: FRAME_SIZE_ERROR", longEnd === 9 && http2ParseFrame(f, longFrame, ZERO, H2_DEFAULT_MAX_FRAME) === H2_FRAME_SIZE_ERROR);
  t.eqI32("the same frame under a larger limit parses", http2ParseFrame(f, longFrame, ZERO, H2_DEFAULT_MAX_FRAME + 1), H2_NO_ERROR);
  const onZero: string[] = ["000001000000000000" + "61", "000001010400000000" + "82", "00000502000000000000000001" + "10", "00000403000000000000000000", "00000505040000000000000002" + "82", "000001090400000000" + "82"];
  let zeroRefused: i32 = 0;
  for (const hex of onZero) {
    zeroRefused = zeroRefused + (parse(f, hex, MAX) === H2_PROTOCOL_ERROR ? 1 : 0);
  }
  t.eqI32("DATA, HEADERS, PRIORITY, RST_STREAM, PUSH_PROMISE and CONTINUATION on stream 0: PROTOCOL_ERROR", zeroRefused, toI32(6));
  const onStream: string[] = ["000000040000000001", "0000080600000000010000000000000000", "0000080700000000010000000000000000"];
  let streamRefused: i32 = 0;
  for (const hex of onStream) {
    streamRefused = streamRefused + (parse(f, hex, MAX) === H2_PROTOCOL_ERROR ? 1 : 0);
  }
  t.eqI32("SETTINGS, PING and GOAWAY on a stream: PROTOCOL_ERROR", streamRefused, toI32(3));
  const sizes: string[] = [
    "000000000800000001",
    "000004012000000001" + "00000000",
    "000003050000000001" + "000000",
    "000003030000000001" + "000000",
    "000005040000000000" + "0000000000",
    "000006040100000000" + "000100000000",
    "000007060000000000" + "00000000000000",
    "000007070000000000" + "00000000000000",
    "000003080000000001" + "000001",
    "000005080000000001" + "0000000100",
  ];
  let sizeRefused: i32 = 0;
  for (const hex of sizes) {
    sizeRefused = sizeRefused + (parse(f, hex, MAX) === H2_FRAME_SIZE_ERROR ? 1 : 0);
  }
  t.eqI32(
    "too short for its fixed fields, or the wrong length — padded DATA of 0, HEADERS with PRIORITY of 4, PUSH_PROMISE of 3, RST_STREAM of 3, SETTINGS of 5, a SETTINGS ACK of 6, PING of 7, GOAWAY of 7, WINDOW_UPDATE of 3 and 5: FRAME_SIZE_ERROR",
    sizeRefused,
    toI32(sizes.length)
  );
  t.eqI32("padding as long as the payload: PROTOCOL_ERROR (§6.1)", parse(f, "000003000800000001" + "036162", MAX), H2_PROTOCOL_ERROR);
  t.eqI32("padding past the fixed fields of a HEADERS: PROTOCOL_ERROR (§6.2)", parse(f, "000007012800000001" + "0300000000ff82", MAX), H2_PROTOCOL_ERROR);
  t.eqI32("or of a PUSH_PROMISE", parse(f, "000006050800000001" + "020000000282", MAX), H2_PROTOCOL_ERROR);
  t.eqI32("a WINDOW_UPDATE of zero on the connection: PROTOCOL_ERROR (§6.9)", parse(f, "000004080000000000" + "00000000", MAX), H2_PROTOCOL_ERROR);

  // --- stream errors ------------------------------------------------------------------------------------
  t.ok("a PRIORITY of the wrong length resets the stream with FRAME_SIZE_ERROR (§6.3)", parse(f, "000004020000000003" + "00000001", MAX) === H2_NO_ERROR && f.streamError === H2_FRAME_SIZE_ERROR);
  t.ok("a PRIORITY on itself resets it with PROTOCOL_ERROR (§5.3.1)", parse(f, "000005020000000003" + "0000000310", MAX) === H2_NO_ERROR && f.streamError === H2_PROTOCOL_ERROR);
  t.ok("so does a HEADERS that depends on itself", parse(f, "000006012400000003" + "800000030f82", MAX) === H2_NO_ERROR && f.streamError === H2_PROTOCOL_ERROR);
  t.ok("a WINDOW_UPDATE of zero on a stream resets it with PROTOCOL_ERROR (§6.9)", parse(f, "000004080000000003" + "00000000", MAX) === H2_NO_ERROR && f.streamError === H2_PROTOCOL_ERROR);
  t.ok("and the next frame read clears it", parse(f, ping, MAX) === H2_NO_ERROR && f.streamError === 0);

  // --- setting values (§6.5.2, RFC 8441 §3) ------------------------------------------------------------
  t.ok(
    "ENABLE_PUSH and ENABLE_CONNECT_PROTOCOL take 0 and 1, and nothing else: PROTOCOL_ERROR",
    http2SettingError(H2_SETTINGS_ENABLE_PUSH, toI64(1)) === H2_NO_ERROR &&
      http2SettingError(H2_SETTINGS_ENABLE_PUSH, toI64(2)) === H2_PROTOCOL_ERROR &&
      http2SettingError(H2_SETTINGS_ENABLE_CONNECT_PROTOCOL, toI64(0)) === H2_NO_ERROR &&
      http2SettingError(H2_SETTINGS_ENABLE_CONNECT_PROTOCOL, toI64(2)) === H2_PROTOCOL_ERROR
  );
  t.ok(
    "INITIAL_WINDOW_SIZE up to 2^31 - 1; past it, FLOW_CONTROL_ERROR",
    http2SettingError(H2_SETTINGS_INITIAL_WINDOW_SIZE, toI64(2147483647)) === H2_NO_ERROR &&
      http2SettingError(H2_SETTINGS_INITIAL_WINDOW_SIZE, toI64(2147483647) + toI64(1)) === H2_FLOW_CONTROL_ERROR
  );
  t.ok(
    "MAX_FRAME_SIZE from 2^14 to 2^24 - 1; outside, PROTOCOL_ERROR",
    http2SettingError(H2_SETTINGS_MAX_FRAME_SIZE, toI64(16384)) === H2_NO_ERROR &&
      http2SettingError(H2_SETTINGS_MAX_FRAME_SIZE, toI64(16777215)) === H2_NO_ERROR &&
      http2SettingError(H2_SETTINGS_MAX_FRAME_SIZE, toI64(16383)) === H2_PROTOCOL_ERROR &&
      http2SettingError(H2_SETTINGS_MAX_FRAME_SIZE, toI64(16777216)) === H2_PROTOCOL_ERROR
  );
  t.ok(
    "HEADER_TABLE_SIZE takes any value, and an unknown setting is not an error",
    http2SettingError(H2_SETTINGS_HEADER_TABLE_SIZE, U32_MAX) === H2_NO_ERROR && http2SettingError(0xff, toI64(12345)) === H2_NO_ERROR
  );


  // --- the registries of §6.5.2, §6.9 and §7 ------------------------------------------------------
  const codes: i32[] = [
    H2_NO_ERROR,
    H2_PROTOCOL_ERROR,
    H2_INTERNAL_ERROR,
    H2_FLOW_CONTROL_ERROR,
    H2_SETTINGS_TIMEOUT,
    H2_STREAM_CLOSED,
    H2_FRAME_SIZE_ERROR,
    H2_REFUSED_STREAM,
    H2_CANCEL,
    H2_COMPRESSION_ERROR,
    H2_CONNECT_ERROR,
    H2_ENHANCE_YOUR_CALM,
    H2_INADEQUATE_SECURITY,
    H2_HTTP_1_1_REQUIRED,
  ];
  let inOrder: boolean = true;
  for (let k: i32 = 0; k < toI32(codes.length); k++) {
    inOrder = inOrder && codes[k] === k;
  }
  t.ok("the error codes of §7 are 0x0 to 0xd, in the RFC's order", inOrder && toI32(codes.length) === 14);
  t.ok(
    "the settings are §6.5.2's identifiers and RFC 8441's 0x8, each six bytes",
    H2_SETTINGS_HEADER_TABLE_SIZE === 1 &&
      H2_SETTINGS_ENABLE_PUSH === 2 &&
      H2_SETTINGS_MAX_CONCURRENT_STREAMS === 3 &&
      H2_SETTINGS_INITIAL_WINDOW_SIZE === 4 &&
      H2_SETTINGS_MAX_FRAME_SIZE === 5 &&
      H2_SETTINGS_MAX_HEADER_LIST_SIZE === 6 &&
      H2_SETTINGS_ENABLE_CONNECT_PROTOCOL === 8 &&
      H2_SETTING_SIZE === 6
  );
  t.ok(
    "a window starts at 65,535 and may reach 2^31 - 1; a header is nine bytes; PRIORITY is 0x2 and CONTINUATION 0x9",
    H2_DEFAULT_WINDOW === 65535 && H2_MAX_WINDOW === 2147483647 && H2_FRAME_HEADER_SIZE === 9 && H2_FRAME_PRIORITY === 2 && H2_FRAME_CONTINUATION === 9
  );
  return t.done();
};

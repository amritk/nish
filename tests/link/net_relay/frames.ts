// `examples/relay/frame.ts` against the fixtures cs's `frame.rs` tests use:
// bytes `encodeFrame` in `packages/protocol/src/session.ts` produced, pasted
// rather than built here, because a codec that agrees with itself proves
// nothing. Every case frame.rs tests, and a negative for each error.
import { Suite } from "nish/testing";
import {
  CLOSE_IDLE,
  CLOSE_RATE_LIMITED,
  FRAME_TRUNCATED,
  FRAME_UNKNOWN_TYPE,
  FRAME_UNTERMINATED,
  MAX_PAYLOAD_BYTES,
  RELAY_CLOSE,
  RELAY_DATA,
  RELAY_HELLO,
  RELAY_HELLO_OK,
  RELAY_PING,
  RELAY_PONG,
  RELAY_PROTOCOL_VERSION,
  RELAY_STATS,
  RelayFrame,
  relayDecode,
  relayEncodeClose,
  relayEncodeData,
  relayEncodeHelloOk,
  relayEncodePong,
  relayEncodeStats,
} from "../../../examples/relay/frame";
import { websocketIsUtf8 } from "nish/net/websocket";
import { fromHex, toHex } from "../crypto_x509/hex";
import { tlsWindowString } from "nish/net/tls/codec";
import { n32, n64 } from "../net_quic_frame/typed";

/** frame.rs's TS_HELLO: `{ type: Hello, version: 1, token: "v1.abc.def" }`. */
export const TS_HELLO: string = "010176312e6162632e64656600";
/** TS_DATA: `{ type: Data, seq: 12345, payload: de ad be ef }`. */
export const TS_DATA: string = "033930deadbeef";
/** TS_PING: `{ type: Ping, id: 7, sentAtMicros: 123456n }`. */
export const TS_PING: string = "040700000040e2010000000000";
/** TS_CLOSE: `{ type: Close, code: RateLimited, reason: "bye" }`. */
export const TS_CLOSE: string = "06030062796500";

/** The text of `f`'s window onto `buf`. */
export const frameText = (f: RelayFrame, buf: u8[]): string => tlsWindowString(buf, f.textStart, f.textLength);

/** The bytes of `f`'s payload window onto `buf`. */
const payloadOf = (f: RelayFrame, buf: u8[]): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = f.payloadStart; k < f.payloadStart + f.payloadLength && k >= 0 && k < toI32(buf.length); k++) {
    out.push(buf[k]);
  }
  return out;
};

/** The first `n` bytes of `out` (none for a negative `n`). */
export const prefix = (out: u8[], n: i32): u8[] => {
  const got: u8[] = [];
  for (let k: i32 = 0; k < n && k < toI32(out.length); k++) {
    got.push(out[k]);
  }
  return got;
};

/** What decoding `hex` answers. */
const decodes = (f: RelayFrame, hex: string): i32 => {
  const buf: u8[] = fromHex(hex);
  return relayDecode(f, buf, n32(0), toI32(buf.length));
};

/** Every frame check. */
export const frameChecks = (t: Suite): void => {
  const f = new RelayFrame();
  const hello: u8[] = fromHex(TS_HELLO);
  t.eqI32("decodes a hello written by the TypeScript", relayDecode(f, hello, n32(0), toI32(hello.length)), RELAY_HELLO);
  t.eqStr("its version and token", `${f.version} ${frameText(f, hello)}`, `${RELAY_PROTOCOL_VERSION} v1.abc.def`);

  const data: u8[] = fromHex(TS_DATA);
  t.eqI32("decodes a data frame", relayDecode(f, data, n32(0), toI32(data.length)), RELAY_DATA);
  t.eqStr("without copying its payload: a window onto the datagram", `${f.seq} ${toHex(payloadOf(f, data))} ${f.payloadStart}`, "12345 deadbeef 3");

  const ping: u8[] = fromHex(TS_PING);
  t.eqI32("decodes a ping", relayDecode(f, ping, n32(0), toI32(ping.length)), RELAY_PING);
  t.eqStr("with a microsecond clock that does not fit in 32 bits", `${f.id} ${f.sentAtMicros}`, "7 123456");

  const close: u8[] = fromHex(TS_CLOSE);
  t.eqI32("decodes a close", relayDecode(f, close, n32(0), toI32(close.length)), RELAY_CLOSE);
  t.eqStr("with its code and reason", `${f.code} ${frameText(f, close)}`, `${CLOSE_RATE_LIMITED} bye`);

  // A window inside a larger buffer: offsets are the buffer's, not the frame's.
  const framed: u8[] = fromHex(`ffff${TS_DATA}ff`);
  relayDecode(f, framed, n32(2), n32(7));
  t.eqStr("a window inside a larger buffer reads only the window", `${f.seq} ${toHex(payloadOf(f, framed))}`, "12345 deadbeef");

  // Encodes the TypeScript can read back, byte for byte.
  const out: u8[] = new Array<u8>(64);
  t.eqStr("HELLO_OK", toHex(prefix(out, relayEncodeHelloOk(out, n32(0), n64(1), MAX_PAYLOAD_BYTES))), "0201000000b004");
  const payload: u8[] = fromHex("deadbeef");
  t.eqStr("DATA", toHex(prefix(out, relayEncodeData(out, n32(0), n32(12345), payload, n32(0), n32(4)))), TS_DATA);
  t.eqStr(
    "PONG",
    toHex(prefix(out, relayEncodePong(out, n32(0), n64(7), n64(123456), n64(250)))),
    "050700000040e2010000000000fa000000"
  );
  t.eqStr("CLOSE", toHex(prefix(out, relayEncodeClose(out, n32(0), CLOSE_IDLE, "idle"))), "06050069646c6500");
  t.eqStr("STATS", toHex(prefix(out, relayEncodeStats(out, n32(0), n64(1000), n64(64), n64(130)))), "07e80300004000000082000000");
  t.eqStr("the sequence number wraps into 16 bits", toHex(prefix(out, relayEncodeData(out, n32(0), n32(65537), payload, n32(0), n32(0)))), "030100");

  // A reused buffer never leaks the previous payload.
  const eight: u8[] = fromHex("0102030405060708");
  relayEncodeData(out, n32(0), n32(1), eight, n32(0), n32(8));
  const nine: u8[] = fromHex("09");
  t.eqStr("a reused buffer never leaks the previous payload", toHex(prefix(out, relayEncodeData(out, n32(0), n32(2), nine, n32(0), n32(1)))), "03020009");

  // Frames that do not fit answer -1 and write past nothing.
  const small: u8[] = new Array<u8>(6);
  t.eqI32("HELLO_OK into 6 bytes does not fit", relayEncodeHelloOk(small, n32(0), n64(1), n32(1200)), n32(-1));
  t.eqI32("DATA of 4 bytes into 6 does not fit", relayEncodeData(small, n32(0), n32(1), payload, n32(0), n32(4)), n32(-1));
  t.eqI32("PONG into 6 bytes does not fit", relayEncodePong(small, n32(0), n64(1), n64(1), n64(1)), n32(-1));
  t.eqI32("CLOSE of 3 characters fits 6 bytes, 4 do not", relayEncodeClose(small, n32(0), n32(0), "byes"), n32(-1));
  t.eqI32("STATS into 6 bytes does not fit", relayEncodeStats(small, n32(0), n64(1), n64(1), n64(1)), n32(-1));
  t.eqI32("a reason that is not ASCII is refused", relayEncodeClose(out, n32(0), n32(0), "café"), n32(-1));

  // Truncation is an error rather than a half-read frame.
  t.eqI32("an empty datagram is truncated", decodes(f, ""), FRAME_TRUNCATED);
  t.eqI32("a ping cut after its id's first byte is truncated", decodes(f, "0401"), FRAME_TRUNCATED);
  t.eqI32("a ping one byte short is truncated", decodes(f, TS_PING.substring(0, 24)), FRAME_TRUNCATED);
  t.eqI32("a hello with no version is truncated", decodes(f, "01"), FRAME_TRUNCATED);
  t.eqI32("a data frame with half a sequence number is truncated", decodes(f, "0339"), FRAME_TRUNCATED);
  t.eqI32("a close with half a code is truncated", decodes(f, "0603"), FRAME_TRUNCATED);
  t.eqI32("a hello whose token runs off the end is unterminated", decodes(f, "01017631"), FRAME_UNTERMINATED);
  t.eqI32("a close whose reason runs off the end is unterminated", decodes(f, "060300627965"), FRAME_UNTERMINATED);
  t.eqI32("an unknown type", decodes(f, "7f"), FRAME_UNKNOWN_TYPE);
  t.eqI32("names the byte", f.type, n32(0x7f));
  t.eqI32("type 0 is unknown", decodes(f, "00"), FRAME_UNKNOWN_TYPE);
  t.eqI32("type 8 is unknown", decodes(f, "08"), FRAME_UNKNOWN_TYPE);

  // A frame only the relay sends is named rather than misread.
  t.ok("a HELLO_OK from a client is named, not read", decodes(f, "0201000000b004") === RELAY_HELLO_OK && f.fromRelay);
  t.ok("so is a PONG", decodes(f, "05") === RELAY_PONG && f.fromRelay);
  t.ok("and a STATS", decodes(f, "07") === RELAY_STATS && f.fromRelay);
  t.ok("a DATA is not", decodes(f, TS_DATA) === RELAY_DATA && !f.fromRelay);

  // Strings: invalid UTF-8 reads as the empty string, as frame.rs reads it.
  t.ok("a hello whose token is not UTF-8 reads as an empty token", decodes(f, "0101ff00") === RELAY_HELLO && f.textLength === n32(0));
  t.ok("an empty token", decodes(f, "010100") === RELAY_HELLO && f.textLength === n32(0));
  const utf8: u8[] = fromHex("c3a9e282acf09f9880");
  t.ok("two-, three- and four-byte sequences are UTF-8 to the check the decoder uses", websocketIsUtf8(utf8, n32(0), toI32(utf8.length)));
  const bad: string[] = ["80", "c0af", "c3", "e080af", "eda080", "f4908080", "f5808080", "e282"];
  let refused: i32 = 0;
  for (const hex of bad) {
    const b: u8[] = fromHex(hex);
    if (!websocketIsUtf8(b, n32(0), toI32(b.length))) {
      refused++;
    }
  }
  t.eqI32("a stray continuation, overlongs, a surrogate, past U+10FFFF and cut sequences are not", refused, toI32(bad.length));
};

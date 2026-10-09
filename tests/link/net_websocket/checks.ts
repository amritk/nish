// `nish/net/websocket` against RFC 6455: the §1.3 accept key, the §5.7
// example frames encoded byte for byte and decoded, a stream of frames fed at
// every split point, fragmentation with control frames between the fragments,
// UTF-8 across fragment boundaries, every refusal with its close code, and the
// opening handshake read through `nish/net/http1`.
import { Suite } from "nish/testing";
import { HTTP1_HEAD, Http1Parser } from "nish/net/http1";
import {
  WS_CLOSE,
  WS_CLOSE_INVALID_DATA,
  WS_CLOSE_NO_STATUS,
  WS_CLOSE_NORMAL,
  WS_CLOSE_PROTOCOL_ERROR,
  WS_CLOSE_TOO_BIG,
  WS_ERROR,
  WS_GUID,
  WS_MAX_CONTROL,
  WS_MESSAGE,
  WS_NEED_MORE,
  WS_NO_ROOM,
  WS_OP_BINARY,
  WS_OP_CLOSE,
  WS_OP_CONTINUATION,
  WS_OP_PING,
  WS_OP_PONG,
  WS_OP_TEXT,
  WS_PING,
  WS_PONG,
  WS_REFUSED,
  WsDecoder,
  websocketAcceptKey,
  websocketClosePayload,
  websocketFrame,
  websocketFrameSize,
  websocketIsUtf8,
  websocketKeyIsValid,
  websocketRequestKey,
  websocketUpgradeResponse,
  websocketWriteFrame,
} from "nish/net/websocket";

const HEX_DIGITS: string = "0123456789abcdef";

/** `buf[off .. off + len)` as lowercase hex. */
const hexOf = (buf: u8[], off: i32, len: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = off; i >= 0 && i < off + len && i < toI32(buf.length); i += 1) {
    const v: i32 = toI32(buf[i]);
    parts.push(HEX_DIGITS.substring(v >> 4, (v >> 4) + 1));
    parts.push(HEX_DIGITS.substring(v & 15, (v & 15) + 1));
  }
  return parts.join("");
};

/** The value of one lowercase hex digit. */
const hexDigit = (c: i32): i32 => (c >= 97 ? c - 87 : c - 48);

/** The bytes a hex string spells, spaces ignored, for the frames below. */
const fromHex = (hex: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(hex.length);
  let i: i32 = 0;
  while (i >= 0 && i + 1 < n && i < n) {
    if (toI32(hex.charCodeAt(i)) === 32) {
      i += 1;
    } else {
      out.push(toU8(hexDigit(toI32(hex.charCodeAt(i))) * 16 + hexDigit(toI32(hex.charCodeAt(i + 1)))));
      i += 2;
    }
  }
  return out;
};

/** The bytes of a string. */
const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** `buf[0 .. len)` as a string. */
const textOf = (buf: u8[], len: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < len && i < toI32(buf.length); i += 1) {
    parts.push(String.fromCharCode(toI32(buf[i])));
  }
  return parts.join("");
};

/** A frame as hex, or "null" for a refusal. */
const frameHex = (frame: u8[] | null): string => (frame === null ? "null" : hexOf(frame, 0, toI32(frame.length)));

/** An event as one line of a transcript. */
const describe = (d: WsDecoder, e: i32): string => {
  if (e === WS_MESSAGE) {
    return d.opcode === WS_OP_TEXT
      ? `text "${textOf(d.data, d.dataLen)}"`
      : `binary ${d.dataLen} bytes ${hexOf(d.data, 0, d.dataLen < 8 ? d.dataLen : 8)}`;
  }
  if (e === WS_PING) {
    return `ping "${textOf(d.data, d.dataLen)}"`;
  }
  if (e === WS_PONG) {
    return `pong "${textOf(d.data, d.dataLen)}"`;
  }
  if (e === WS_CLOSE) {
    return `close ${d.closeCode} "${d.closeReason}"`;
  }
  if (e === WS_ERROR) {
    return `error ${d.closeCode}`;
  }
  return `event ${e}`;
};

/** Pulls events into `log` until the decoder wants more or has stopped; answers the last. */
const drain = (d: WsDecoder, log: string[]): i32 => {
  let e: i32 = d.next();
  while (e !== WS_NEED_MORE && e !== WS_CLOSE && e !== WS_ERROR) {
    log.push(describe(d, e));
    e = d.next();
  }
  return e;
};

/** The transcript of `data` fed to a decoder as `data[0 .. cut)` and then the rest. */
const transcript = (data: u8[], cut: i32, server: boolean): string => {
  const maxMessage: i32 = 100000;
  const d: WsDecoder = new WsDecoder(server, maxMessage);
  const log: string[] = [];
  const start: i32 = 0;
  d.feed(data, start, cut);
  drain(d, log);
  d.feed(data, cut, toI32(data.length) - cut);
  const last: i32 = drain(d, log);
  log.push(last === WS_NEED_MORE ? "needs more" : describe(d, last));
  return log.join("\n");
};

/** The first cut of `data` whose transcript differs from the whole one, or -1. */
const firstBadCut = (data: u8[], server: boolean): i32 => {
  const n: i32 = toI32(data.length);
  const whole: string = transcript(data, n, server);
  for (let cut: i32 = 0; cut < n; cut += 1) {
    // Each pass builds a decoder and its transcript, which nothing keeps. A
    // `using a = arena()` block would free them, but NL2424 refuses it: the decoder
    // stores what it allocates into memory. The inputs are short, so the passes are
    // left to the arena until the program exits.
    const same: boolean = transcript(data, cut, server) === whole;
    if (!same) {
      return cut;
    }
  }
  return -1;
};

/** The close code `hex` is refused with by a decoder of the given role, or 0 when it is not. */
const refusalOf = (hex: string, server: boolean): i32 => {
  const maxMessage: i32 = 300;
  const d: WsDecoder = new WsDecoder(server, maxMessage);
  const data: u8[] = fromHex(hex);
  const start: i32 = 0;
  d.feed(data, start, toI32(data.length));
  const log: string[] = [];
  return drain(d, log) === WS_ERROR ? d.closeCode : 0;
};

/** `n` copies of `b` as hex. */
const repeatHex = (b: string, n: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < n; i += 1) {
    parts.push(b);
  }
  return parts.join("");
};

/** The head an `Http1Parser` reads from `text`, for the handshake checks. */
const headOf = (text: string): Http1Parser => {
  const p: Http1Parser = new Http1Parser(64, 1024, 16, 0);
  const data: u8[] = bytesOf(text);
  const start: i32 = 0;
  p.feed(data, start, toI32(data.length));
  if (p.next() !== HTTP1_HEAD) {
    panic("net_websocket: a handshake fixture that is not a head");
  }
  return p;
};

/** The key `websocketRequestKey` answers for `text`, or "null". */
const requestKeyOf = (text: string): string => {
  const key: string | null = websocketRequestKey(headOf(text));
  return key === null ? "null" : key;
};

const SAMPLE_REQUEST: string =
  "GET /chat HTTP/1.1\r\nHost: server.example.com\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
  "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nOrigin: http://example.com\r\n" +
  "Sec-WebSocket-Protocol: chat, superchat\r\nSec-WebSocket-Version: 13\r\n\r\n";

/**
 * Runs every check and answers the exit code. A function of its own so that
 * `tests/link/net_websocket_f64` can run the same checks under
 * `--number-mode f64`.
 */
export const websocketChecks = (): i32 => {
  const t = new Suite("websocket");
  const zero: i32 = 0;
  const none: i32 = -1;

  // --- The opening handshake (§1.3, §4.2) ----------------------------------
  t.eqStr("WS_GUID is §1.3's", WS_GUID, "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
  t.eqStr(
    "the §1.3 accept key: dGhlIHNhbXBsZSBub25jZQ== gives s3pPLMBiTxaQ9kYGzzhZRbK+xOo=",
    websocketAcceptKey("dGhlIHNhbXBsZSBub25jZQ=="),
    "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
  );
  // A key whose accept value has both a `+` and a `/`, where the URL alphabet
  // would have `-` and `_` (checked against OpenSSL).
  t.eqStr("an accept key with + and /", websocketAcceptKey("MDAwMDAwMDAwMDAwMDAxMg=="), "SI8+ZDWY/3CvhQ4D69HioKIAv9s=");
  t.eqBool("the §1.3 key is valid", websocketKeyIsValid("dGhlIHNhbXBsZSBub25jZQ=="), true);
  t.eqBool("a key with + and / is valid", websocketKeyIsValid("ab+/ab+/ab+/ab+/ab+/aQ=="), true);
  t.eqBool("refused key: 23 characters", websocketKeyIsValid("dGhlIHNhbXBsZSBub25jZQ="), false);
  t.eqBool("refused key: no padding", websocketKeyIsValid("dGhlIHNhbXBsZSBub25jZQAA"), false);
  t.eqBool("refused key: a URL-alphabet character", websocketKeyIsValid("ab-_ab+/ab+/ab+/ab+/aQ=="), false);
  t.eqBool("refused key: a character outside the alphabet", websocketKeyIsValid("dGhlIHNhbXBsZSBub25jZ!=="), false);
  t.eqBool("refused key: nonzero unused bits", websocketKeyIsValid("dGhlIHNhbXBsZSBub25jZR=="), false);
  t.eqBool("refused key: padding inside", websocketKeyIsValid("dGhlIHNh=XBsZSBub25jZQ=="), false);

  t.eqStr("the §1.3 request's key", requestKeyOf(SAMPLE_REQUEST), "dGhlIHNhbXBsZSBub25jZQ==");
  t.eqStr(
    "Upgrade: WebSocket in another case",
    requestKeyOf(
      "GET / HTTP/1.1\r\nHost: a\r\nUpgrade: WebSocket\r\nConnection: upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n"
    ),
    "dGhlIHNhbXBsZSBub25jZQ=="
  );
  t.eqStr(
    "not a handshake: POST",
    requestKeyOf(
      "POST / HTTP/1.1\r\nHost: a\r\nUpgrade: websocket\r\nConnection: upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n"
    ),
    "null"
  );
  t.eqStr(
    "not a handshake: HTTP/1.0",
    requestKeyOf(
      "GET / HTTP/1.0\r\nUpgrade: websocket\r\nConnection: upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n"
    ),
    "null"
  );
  t.eqStr(
    "not a handshake: no Connection: upgrade",
    requestKeyOf(
      "GET / HTTP/1.1\r\nHost: a\r\nUpgrade: websocket\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n"
    ),
    "null"
  );
  t.eqStr(
    "not a handshake: Upgrade: h2c",
    requestKeyOf(
      "GET / HTTP/1.1\r\nHost: a\r\nUpgrade: h2c\r\nConnection: upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n"
    ),
    "null"
  );
  t.eqStr(
    "not a handshake: version 8",
    requestKeyOf(
      "GET / HTTP/1.1\r\nHost: a\r\nUpgrade: websocket\r\nConnection: upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 8\r\n\r\n"
    ),
    "null"
  );
  t.eqStr(
    "not a handshake: no version",
    requestKeyOf(
      "GET / HTTP/1.1\r\nHost: a\r\nUpgrade: websocket\r\nConnection: upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n"
    ),
    "null"
  );
  t.eqStr(
    "not a handshake: no key",
    requestKeyOf("GET / HTTP/1.1\r\nHost: a\r\nUpgrade: websocket\r\nConnection: upgrade\r\nSec-WebSocket-Version: 13\r\n\r\n"),
    "null"
  );
  t.eqStr(
    "not a handshake: a key of 15 bytes",
    requestKeyOf(
      "GET / HTTP/1.1\r\nHost: a\r\nUpgrade: websocket\r\nConnection: upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25j\r\nSec-WebSocket-Version: 13\r\n\r\n"
    ),
    "null"
  );

  const accepted: u8[] | null = websocketUpgradeResponse("dGhlIHNhbXBsZSBub25jZQ==", "chat");
  t.eqStr(
    "the §1.3 response, with the protocol the server chose",
    accepted === null ? "null" : textOf(accepted, toI32(accepted.length)),
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
      "Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\nSec-WebSocket-Protocol: chat\r\n\r\n"
  );
  const plain: u8[] | null = websocketUpgradeResponse("dGhlIHNhbXBsZSBub25jZQ==", "");
  t.eqStr(
    "a response with no protocol",
    plain === null ? "null" : textOf(plain, toI32(plain.length)),
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
      "Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\n\r\n"
  );
  t.eqBool("refused response: an invalid key", websocketUpgradeResponse("short==", "") === null, true);
  t.eqBool(
    "refused response: a protocol that would split the response",
    websocketUpgradeResponse("dGhlIHNhbXBsZSBub25jZQ==", "chat\r\nX: y") === null,
    true
  );

  // --- §5.7's examples, encoded ----------------------------------------------
  const hello: u8[] = bytesOf("Hello");
  const helloLength: i32 = 5;
  const key: u8[] = fromHex("37fa213d");
  t.eqStr(
    "§5.7: a single-frame unmasked text message",
    frameHex(websocketFrame(true, WS_OP_TEXT, hello, zero, helloLength, null)),
    "810548656c6c6f"
  );
  t.eqStr(
    "§5.7: a single-frame masked text message",
    frameHex(websocketFrame(true, WS_OP_TEXT, hello, zero, helloLength, key)),
    "818537fa213d7f9f4d5158"
  );
  const three: i32 = 3;
  const two: i32 = 2;
  t.eqStr(
    "§5.7: the first fragment of an unmasked text message",
    frameHex(websocketFrame(false, WS_OP_TEXT, hello, zero, three, null)),
    "010348656c"
  );
  t.eqStr(
    "§5.7: the second fragment",
    frameHex(websocketFrame(true, WS_OP_CONTINUATION, hello, three, two, null)),
    "80026c6f"
  );
  t.eqStr(
    "§5.7: an unmasked ping",
    frameHex(websocketFrame(true, WS_OP_PING, hello, zero, helloLength, null)),
    "890548656c6c6f"
  );
  t.eqStr(
    "§5.7: a masked pong answering it",
    frameHex(websocketFrame(true, WS_OP_PONG, hello, zero, helloLength, key)),
    "8a8537fa213d7f9f4d5158"
  );
  const kib: u8[] = new Array<u8>(65536);
  const k256: i32 = 256;
  const k64: i32 = 65536;
  const frame256: u8[] | null = websocketFrame(true, WS_OP_BINARY, kib, zero, k256, null);
  t.eqStr(
    "§5.7: 256 bytes of binary in a single unmasked frame (the header)",
    frame256 === null ? "null" : hexOf(frame256, 0, 4),
    "827e0100"
  );
  t.eqI32("and its length", frame256 === null ? zero : toI32(frame256.length), k256 + 4);
  const frame64k: u8[] | null = websocketFrame(true, WS_OP_BINARY, kib, zero, k64, null);
  t.eqStr(
    "§5.7: 64 KiB of binary in a single unmasked frame (the header)",
    frame64k === null ? "null" : hexOf(frame64k, 0, 10),
    "827f0000000000010000"
  );
  t.eqI32("and its length", frame64k === null ? zero : toI32(frame64k.length), k64 + 10);
  const k125: i32 = 125;
  const k126: i32 = 126;
  const k65535: i32 = 65535;
  const frame125: u8[] | null = websocketFrame(true, WS_OP_PING, kib, zero, k125, null);
  t.eqStr("a 125-byte ping keeps the 7-bit length", frame125 === null ? "null" : hexOf(frame125, 0, 2), "897d");
  const frame126: u8[] | null = websocketFrame(true, WS_OP_BINARY, kib, zero, k126, null);
  t.eqStr("126 bytes take the 16-bit length", frame126 === null ? "null" : hexOf(frame126, 0, 4), "827e007e");
  const frame65535: u8[] | null = websocketFrame(false, WS_OP_BINARY, kib, zero, k65535, key);
  t.eqStr(
    "65535 bytes masked keep the 16-bit length",
    frame65535 === null ? "null" : hexOf(frame65535, 0, 8),
    "02feffff37fa213d"
  );
  const reserved: i32 = 3;
  const control: i32 = 11;
  const shortKey: u8[] = fromHex("37fa21");
  t.eqStr("refused frame: opcode 3", frameHex(websocketFrame(true, reserved, hello, zero, helloLength, null)), "null");
  t.eqStr("refused frame: opcode 11", frameHex(websocketFrame(true, control, hello, zero, helloLength, null)), "null");
  t.eqStr("refused frame: a ping that is not FIN", frameHex(websocketFrame(false, WS_OP_PING, hello, zero, helloLength, null)), "null");
  t.eqStr("refused frame: a 126-byte pong", frameHex(websocketFrame(true, WS_OP_PONG, kib, zero, k126, null)), "null");
  t.eqStr("refused frame: a 3-byte mask", frameHex(websocketFrame(true, WS_OP_TEXT, hello, zero, helloLength, shortKey)), "null");

  t.eqStr("a close payload: 1000 and \"bye\"", frameHex(websocketClosePayload(WS_CLOSE_NORMAL, "bye")), "03e8627965");
  const app: i32 = 4999;
  t.eqStr("a close payload: 4999, no reason", frameHex(websocketClosePayload(app, "")), "1387");
  const codes: i32[] = [999, 1004, 1005, 1006, 1015, 1016, 2999, 5000];
  for (const code of codes) {
    t.eqStr(`refused close payload: code ${code}`, frameHex(websocketClosePayload(code, "")), "null");
  }
  const reason123: string[] = [];
  for (let i: i32 = 0; i < 123; i += 1) {
    reason123.push("r");
  }
  const r123: string = reason123.join("");
  t.eqI32("a 123-byte reason fills a control frame", toI32(frameHex(websocketClosePayload(WS_CLOSE_NORMAL, r123)).length), k125 + k125);
  t.eqStr("refused close payload: a 124-byte reason", frameHex(websocketClosePayload(WS_CLOSE_NORMAL, `${r123}r`)), "null");
  t.eqStr("refused close payload: a reason that is not UTF-8", frameHex(websocketClosePayload(WS_CLOSE_NORMAL, String.fromCharCode(255))), "null");

  // --- §5.7's examples, decoded, and a stream cut at every byte --------------
  t.eqStr("§5.7 unmasked text, read by a client", transcript(fromHex("810548656c6c6f"), 7, false), 'text "Hello"\nneeds more');
  t.eqStr("§5.7 masked text, read by a server", transcript(fromHex("818537fa213d7f9f4d5158"), 11, true), 'text "Hello"\nneeds more');
  t.eqStr("§5.7 fragments, read as one message", transcript(fromHex("010348656c 80026c6f"), 9, false), 'text "Hello"\nneeds more');
  t.eqStr("§5.7 ping", transcript(fromHex("890548656c6c6f"), 7, false), 'ping "Hello"\nneeds more');
  t.eqStr("§5.7 masked pong", transcript(fromHex("8a8537fa213d7f9f4d5158"), 11, true), 'pong "Hello"\nneeds more');
  const big: u8[] = fromHex("827e0100");
  for (let i: i32 = 0; i < 256; i += 1) {
    big.push(toU8(i));
  }
  t.eqStr("§5.7 256 bytes of binary", transcript(big, toI32(big.length), false), "binary 256 bytes 0001020304050607\nneeds more");
  const huge: u8[] = fromHex("827f0000000000010000");
  for (let i: i32 = 0; i < 65536; i += 1) {
    huge.push(toU8(i >> 8));
  }
  t.eqStr("§5.7 64 KiB of binary", transcript(huge, toI32(huge.length), false), "binary 65536 bytes 0000000000000000\nneeds more");

  // A server's stream: a fragmented text message with a ping between its
  // fragments, a binary message, a pong, and a close with a reason; every
  // frame masked with a different key, the message's euro sign cut between
  // two fragments (e2 | 82 ac).
  const stream: u8[] = fromHex(
    "01 83 01020304 49 67 e1" + // "He" and e2, masked: 48^01 65^02 e2^03
      "89 82 0a0b0c0d 63 62" + // ping "ii" (63^0a, 62^0b) between the fragments
      "80 83 00000000 82 ac 21" + // 82 ac and "!", unmasked by a zero key
      "82 82 ffffffff 00 ff" + // binary ff 00
      "8a 80 01020304" + // an empty pong
      "88 85 00000000 03 e8 62 79 65" // close 1000 "bye"
  );
  const streamTranscript: string = 'ping "ii"\ntext "He€!"\nbinary 2 bytes ff00\npong ""\nclose 1000 "bye"';
  t.eqStr("a server's stream, whole", transcript(stream, toI32(stream.length), true), streamTranscript);
  t.eqI32("the same stream cut at every byte", firstBadCut(stream, true), none);
  const clientStream: u8[] = fromHex("010348656c 890548656c6c6f 80026c6f 880203e9");
  t.eqStr(
    "a client's stream with a ping between fragments, whole",
    transcript(clientStream, toI32(clientStream.length), false),
    'ping "Hello"\ntext "Hello"\nclose 1001 ""'
  );
  t.eqI32("the client's stream cut at every byte", firstBadCut(clientStream, false), none);

  // --- Close, and the decoder after it ---------------------------------------
  const closing: WsDecoder = new WsDecoder(false, 100);
  const closeFrames: u8[] = fromHex("8800 810548656c6c6f");
  closing.feed(closeFrames, zero, toI32(closeFrames.length));
  t.eqI32("a close frame with no payload", closing.next(), WS_CLOSE);
  t.eqI32("reports no status", closing.closeCode, WS_CLOSE_NO_STATUS);
  t.eqI32("and the close is final", closing.next(), WS_CLOSE);
  closing.feed(closeFrames, zero, toI32(closeFrames.length));
  t.eqI32("input after it is dropped", closing.next(), WS_CLOSE);

  // --- The refusals -----------------------------------------------------------
  const refusals: string[] = [
    "c10548656c6c6f", "RSV1 set",
    "a10548656c6c6f", "RSV2 set",
    "910548656c6c6f", "RSV3 set",
    "830548656c6c6f", "opcode 3",
    "8b00", "opcode 11",
    "090548656c6c6f", "a fragmented ping",
    "897e007e" + repeatHex("00", 126), "a 126-byte ping",
    "818537fa213d7f9f4d5158", "a masked frame to a client",
    "827e007d" + repeatHex("00", 125), "a 16-bit length of 125",
    "827f000000000000ffff", "a 64-bit length of 65535",
    "827f8000000000000000", "a 64-bit length with its top bit set",
    "800548656c6c6f", "a continuation with no message",
    "010348656c 810548656c6c6f", "a text message inside a fragmented one",
    "880103", "a close with a one-byte payload",
    "880203e7", "close code 999",
    "880203ec", "close code 1004",
    "880203ed", "close code 1005",
    "880203ee", "close code 1006",
    "880203f7", "close code 1015",
    "88020bb7", "close code 2999",
    "8802138a", "close code 5000",
  ];
  for (let i: i32 = 0; i >= 0 && i + 1 < toI32(refusals.length) && i < toI32(refusals.length); i += 2) {
    t.eqI32(`refused with 1002: ${refusals[i + 1]}`, refusalOf(refusals[i], false), WS_CLOSE_PROTOCOL_ERROR);
  }
  t.eqI32("refused with 1002: an unmasked frame to a server", refusalOf("810548656c6c6f", true), WS_CLOSE_PROTOCOL_ERROR);
  const invalid: string[] = [
    "8102c080", "an overlong NUL",
    "8103eda080", "a surrogate",
    "8104f4908080", "a code point past U+10FFFF",
    "8101f5", "the byte f5",
    "8101ff", "the byte ff",
    "810180", "a stray continuation byte",
    "8102e282", "a character cut by the end of the message",
    "0102e282 8001ff", "a bad byte in the second fragment",
    "880403e8c328", "a close reason that is not UTF-8",
  ];
  for (let i: i32 = 0; i >= 0 && i + 1 < toI32(invalid.length) && i < toI32(invalid.length); i += 2) {
    t.eqI32(`refused with 1007: ${invalid[i + 1]}`, refusalOf(invalid[i], false), WS_CLOSE_INVALID_DATA);
  }
  // The bad byte in the first fragment is refused before the message ends.
  t.eqI32("refused with 1007 at the first fragment: c0 never starts a character", refusalOf("0101c0", false), WS_CLOSE_INVALID_DATA);
  t.eqI32("refused with 1009: a 301-byte message", refusalOf(`827e012d${repeatHex("00", 301)}`, false), WS_CLOSE_TOO_BIG);
  t.eqI32("refused with 1009 from the header alone", refusalOf("827e012d", false), WS_CLOSE_TOO_BIG);
  t.eqI32(
    "refused with 1009: fragments that pass the limit together",
    refusalOf(`027e00c8${repeatHex("00", 200)}007e00c8`, false),
    WS_CLOSE_TOO_BIG
  );
  t.eqI32("refused with 1009: a 64-bit length past 2^31", refusalOf("827f0000000100000000", false), WS_CLOSE_TOO_BIG);
  t.eqI32("a 300-byte message is read", refusalOf(`827e012c${repeatHex("00", 300)}`, false), zero);

  const negativeLimit: i32 = -1;
  const tight: WsDecoder = new WsDecoder(false, negativeLimit);
  const emptyThenOne: u8[] = fromHex("8100 810141");
  tight.feed(emptyThenOne, zero, toI32(emptyThenOne.length));
  t.eqI32("a negative message limit reads an empty message", tight.next(), WS_MESSAGE);
  t.eqI32("and refuses a one-byte one", tight.next(), WS_ERROR);
  t.eqI32("with 1009", tight.closeCode, WS_CLOSE_TOO_BIG);

  const after: WsDecoder = new WsDecoder(true, 100);
  const bad: u8[] = fromHex("810548656c6c6f");
  after.feed(bad, zero, toI32(bad.length));
  t.eqI32("an error is reported", after.next(), WS_ERROR);
  t.eqStr("with its reason", after.closeReason, "an unmasked frame from a client");
  t.eqI32("and is final", after.next(), WS_ERROR);

  // --- UTF-8 -------------------------------------------------------------------
  const utf8: u8[] = fromHex("24 c2a2 e282ac f0908d88 00 7f efbfbf f48fbfbf");
  t.eqBool("UTF-8 of one to four bytes, NUL and the largest code point", websocketIsUtf8(utf8, zero, toI32(utf8.length)), true);
  const cut: i32 = 4;
  t.eqBool("a window ending inside a character is not", websocketIsUtf8(utf8, zero, cut), false);
  const empty: u8[] = [];
  t.eqBool("the empty window is", websocketIsUtf8(empty, zero, zero), true);

  // --- Writing into a caller's buffer, and starting over ------------------------
  const into: u8[] = new Array<u8>(20);
  const helloBytes: u8[] = fromHex("48656c6c6f");
  const five: i32 = 5;
  const offset: i32 = 2;
  const written: i32 = websocketWriteFrame(into, offset, true, WS_OP_TEXT, helloBytes, zero, five, null);
  t.eqStr("websocketWriteFrame writes §5.7's unmasked Hello at its offset", hexOf(into, offset, written - offset), "810548656c6c6f");
  const masked: i32 = websocketWriteFrame(into, zero, true, WS_OP_TEXT, helloBytes, zero, five, fromHex("37fa213d"));
  t.eqStr("and the masked one", hexOf(into, zero, masked), "818537fa213d7f9f4d5158");
  t.ok(
    "websocketFrameSize counts each length form and the mask",
    websocketFrameSize(toI32(125), false) === 127 &&
      websocketFrameSize(toI32(126), false) === 130 &&
      websocketFrameSize(toI32(65536), true) === 65550
  );
  const small: u8[] = new Array<u8>(6);
  t.eqI32("a frame that does not fit is WS_NO_ROOM", websocketWriteFrame(small, zero, true, WS_OP_TEXT, helloBytes, zero, five, null), WS_NO_ROOM);
  const sevenBytes: u8[] = new Array<u8>(7);
  t.eqI32("one that just fits is written", websocketWriteFrame(sevenBytes, zero, true, WS_OP_TEXT, helloBytes, zero, five, null), toI32(7));
  t.eqI32("refused: a reserved opcode", websocketWriteFrame(into, zero, true, toI32(3), helloBytes, zero, five, null), WS_REFUSED);
  t.eqI32("refused: a fragmented ping", websocketWriteFrame(into, zero, false, WS_OP_PING, helloBytes, zero, five, null), WS_REFUSED);
  t.eqI32("refused: a 3-byte mask", websocketWriteFrame(into, zero, true, WS_OP_TEXT, helloBytes, zero, five, fromHex("010203")), WS_REFUSED);

  const reused: WsDecoder = new WsDecoder(true, 100);
  reused.feed(bad, zero, toI32(bad.length));
  reused.next();
  reused.reset();
  const maskedHello: u8[] = fromHex("818537fa213d7f9f4d5158");
  reused.feed(maskedHello, zero, toI32(maskedHello.length));
  t.eqI32("reset() starts a refused decoder over", reused.next(), WS_MESSAGE);
  t.eqStr("and it reads the next connection's message", hexOf(reused.data, zero, reused.dataLen), "48656c6c6f");

  // Constants the encoder and decoder agree on.
  t.eqI32("WS_MAX_CONTROL is 125 (§5.5)", WS_MAX_CONTROL, k125);
  t.eqI32("WS_OP_CLOSE is 8 (§5.2)", WS_OP_CLOSE, WS_OP_PING - 1);
  t.eqI32("WS_MESSAGE follows WS_NEED_MORE", WS_MESSAGE, WS_NEED_MORE + 1);
  t.eqI32("WS_CLOSE_TOO_BIG is 1009 (§7.4.1)", WS_CLOSE_TOO_BIG, WS_CLOSE_NORMAL + 9);
  return t.done();
};

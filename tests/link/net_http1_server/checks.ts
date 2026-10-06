// `nish/net/http1-server`: Nish clients over loopback against both carriers
// in one loop, then one connection driven directly, with no socket.
//
//   1. Plain TCP: a GET answered byte for byte; a chunked POST cut at every
//      byte and fed a byte at a time, echoed whole every time; a pipelined
//      pair; a body larger than any buffer each way, streamed; HEAD; 100
//      Continue; an upgrade the program declines; HTTP/1.0 with and without
//      keep-alive; Connection: close.
//   2. WebSocket over the upgrade: the 101, an echo of text and binary, a
//      ping answered, the close answered; a frame the server refuses.
//   3. A warmed slot serves two hundred requests with the arena flat.
//   4. Every refusal of a request, each answered with its status and a close.
//   5. The end of the stream mid-request, a client gone mid-response, the
//      idle timeout, the pool, a free slot.
//   6. TLS: ALPN http/1.1, no ALPN, ALPN h2 shut down, the arena flat.
//   7. The connection alone: every refusal of `respond`, `write`, `end`,
//      `acceptWebSocket`, `sendFrame` and `closeWebSocket`.
//
// A third-party client drives the same servers in `serve` mode (`main.ts`).
import { netShutdown } from "nish:net";
import { HTTP1_CHUNKED, HTTP1_NO_BODY } from "nish/net/http1";
import {
  H1_AGAIN,
  H1_ALPN,
  H1_BODY,
  H1_CLOSED,
  H1_DONE,
  H1_END,
  H1_ERROR,
  H1_INVALID,
  H1_NEED_MORE,
  H1_REQUEST,
  H1_WRITE,
  H1_WS_CLOSE,
  H1_WS_MESSAGE,
  Http1Config,
  Http1Connection,
} from "nish/net/http1-server";
import {
  WS_CLOSE,
  WS_CLOSE_NO_STATUS,
  WS_MESSAGE,
  WS_NEED_MORE,
  WS_OP_BINARY,
  WS_OP_CLOSE,
  WS_OP_PING,
  WS_OP_PONG,
  WS_OP_TEXT,
  WS_PONG,
  WsDecoder,
  websocketClosePayload,
  websocketFrame,
} from "nish/net/websocket";
import { TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { TLS_CONTENT_ALERT, TLS_CONTENT_APPLICATION_DATA, TLS_CONTENT_HANDSHAKE, TlsRecordProtection } from "nish/net/tls/record";
import { TLS_GROUP_X25519, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec";
import { Suite } from "nish/testing";
import { leafPublic, tcpConfig } from "../net_tls_common/server";
import { GROUP_SECP256R1, clientFinish, clientHello, clientShare, extAlpn, extKeyShare, extSignatureAlgorithms, extSupportedGroups, extSupportedVersions } from "../net_tls_common/client";
import { Opened, ZERO, ascii, join, openOne, protectionFor, range, sealOne } from "../net_tls_record_common/bytes";
import { clearRecord, clientKeysFor } from "../net_tls_record_common/client";
import { BIG_SIZE, ClientReader, H1Loop, bigByte } from "./harness";

/** The caps every server here runs with: small buffers, so that every body is larger than all of them. */
export const testConfig = (): Http1Config => {
  const config = new Http1Config();
  config.maxTarget = 256;
  config.maxHeaderBytes = 1024;
  config.maxHeaders = 32;
  config.maxBody = 4194304;
  config.chunkSize = 4096;
  config.outputSize = 8192;
  config.maxMessage = 131072;
  config.idleTimeout = 1000;
  return config;
};

/** A client frame, masked with 01 02 03 04. */
const clientFrame = (opcode: i32, payload: u8[]): u8[] => {
  const mask: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4)];
  const frame: u8[] | null = websocketFrame(true, opcode, payload, ZERO, toI32(payload.length), mask);
  return frame === null ? [] : frame;
};

/** The next WebSocket event client `index` reads, its bytes fed to `d` as they arrive. */
const wsEvent = (lb: H1Loop, index: i32, d: WsDecoder): i32 => {
  let event: i32 = d.next();
  while (event === WS_NEED_MORE && lb.failure === "") {
    const got: u8[] = lb.peers[index].got;
    if (toI32(got.length) > 0) {
      d.feed(got, ZERO, toI32(got.length));
      lb.peers[index].take(toI32(got.length));
    } else if (lb.peers[index].ended) {
      return WS_NEED_MORE;
    } else {
      lb.step(toI32(-1));
    }
    event = d.next();
  }
  return event;
};

/** `n` bytes of `/big`'s pattern, which a reader with `keep` off checks. */
const patterned = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  for (let k: i32 = 0; k < n; k++) {
    out[k] = toU8(bigByte(k));
  }
  return out;
};

/** A new plain client that sends `request` alone; the status it was answered with, or -1. */
const statusFor = (lb: H1Loop, request: string): i32 => {
  const c: i32 = lb.connect(false);
  lb.send(c, ascii(request));
  const r = lb.response(c, false);
  const ended: boolean = lb.awaitEnd(c);
  return r.done && ended && r.has("Connection: close") && r.has("Content-Length: 0") ? r.status : toI32(-1);
};

/** The status of the first response `conn` holds in its output, or -1. */
const outputStatus = (conn: Http1Connection): i32 => {
  if (conn.outputEnd - conn.outputStart < 12) {
    return -1;
  }
  const at: i32 = conn.outputStart + 9;
  return (toI32(conn.output[at]) - 48) * 100 + (toI32(conn.output[at + 1]) - 48) * 10 + (toI32(conn.output[at + 2]) - 48);
};

/** The text of what `conn` holds to send, which is then marked sent. */
const sent = (conn: Http1Connection): string => {
  const parts: string[] = [];
  for (let k: i32 = conn.outputStart; k < conn.outputEnd; k++) {
    parts.push(String.fromCharCode(toI32(conn.output[k])));
  }
  conn.consume(conn.outputEnd - conn.outputStart);
  return parts.join("");
};

/** What `conn` holds to send, as hex, which is then marked sent. */
const sentHex = (conn: Http1Connection): string => {
  const digits: string = "0123456789abcdef";
  const parts: string[] = [];
  for (let k: i32 = conn.outputStart; k < conn.outputEnd; k++) {
    const v: i32 = toI32(conn.output[k]);
    parts.push(digits.substring(v >> 4, (v >> 4) + 1));
    parts.push(digits.substring(v & 15, (v & 15) + 1));
  }
  conn.consume(conn.outputEnd - conn.outputStart);
  return parts.join("");
};

/** A connection under `config` fed `text`, and its first event. */
class Driven {
  conn: Http1Connection;
  event: i32 = 0;
  constructor(config: Http1Config, text: string) {
    this.conn = new Http1Connection(config);
    const bytes: u8[] = ascii(text);
    this.conn.feed(bytes, ZERO, toI32(bytes.length));
    this.event = this.conn.next();
  }
}

/** The suite every TLS client here offers. */
const SUITE: i32 = TLS_CHACHA20_POLY1305_SHA256;

/** One TLS client: its socket in the loop, its record keys, and the plaintext it has read. */
class TlsClient {
  lb: H1Loop;
  index: i32 = -1;
  read: TlsRecordProtection;
  write: TlsRecordProtection;
  plain: u8[];
  alerts: string[];
  verified: boolean = false;

  constructor(lb: H1Loop) {
    this.lb = lb;
    this.read = new TlsRecordProtection();
    this.write = new TlsRecordProtection();
    this.plain = [];
    this.alerts = [];
  }

  /** Connects and completes a TLS 1.3 handshake offering `alpn`; false when anything went wrong. */
  handshake(alpn: string[]): boolean {
    this.index = this.lb.connect(true);
    if (this.index < 0) {
      return false;
    }
    const extensions: u8[][] = [
      extSupportedVersions([TLS_VERSION_13]),
      extSupportedGroups([TLS_GROUP_X25519, GROUP_SECP256R1]),
      extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
      extKeyShare([TLS_GROUP_X25519], [clientShare()]),
    ];
    if (toI32(alpn.length) > 0) {
      extensions.push(extAlpn(alpn));
    }
    const hello: u8[] = clientHello([SUITE], extensions);
    this.lb.send(this.index, clearRecord(hello));
    const serverHello: u8[] = this.lb.nextRecord(this.index);
    if (toI32(serverHello.length) < 5) {
      return false;
    }
    const helloBody: u8[] = range(serverHello, toI32(5), toI32(serverHello.length));
    const keys = clientKeysFor(32, hello, helloBody);
    const flight: Opened = openOne(protectionFor(SUITE, keys.serverHandshake), this.lb.nextRecord(this.index));
    const view = clientFinish(32, hello, helloBody, flight.content, leafPublic());
    this.verified = view.signatureVerifies && view.serverFinishedVerifies;
    keys.finishWith(flight.content);
    this.read.install(SUITE, keys.serverApplication);
    this.write.install(SUITE, keys.clientApplication);
    this.lb.send(this.index, sealOne(protectionFor(SUITE, keys.clientHandshake), TLS_CONTENT_HANDSHAKE, keys.finished, ZERO));
    return true;
  }

  /** Seals `text` into an application-data record and sends it. */
  send(text: string): void {
    this.lb.send(this.index, sealOne(this.write, TLS_CONTENT_APPLICATION_DATA, ascii(text), ZERO));
  }

  /** Reads records until `r` has a whole response, an alert arrives, or the stream ends; answers `r`. */
  response(r: ClientReader): ClientReader {
    while (!r.advance(this.plain) && toI32(this.alerts.length) === 0) {
      const record: u8[] = this.lb.nextRecord(this.index);
      if (toI32(record.length) === 0) {
        break;
      }
      const opened: Opened = openOne(this.read, record);
      if (opened.type === TLS_CONTENT_ALERT && toI32(opened.content.length) === 2) {
        this.alerts.push(`${opened.content[0]} ${opened.content[1]}`);
      } else if (opened.type === TLS_CONTENT_APPLICATION_DATA) {
        for (const b of opened.content) {
          this.plain.push(b);
        }
      }
    }
    this.plain = range(this.plain, r.pos, toI32(this.plain.length));
    return r;
  }
}

/**
 * Runs every check and answers the exit code. A function of its own so that
 * `tests/link/net_http1_server_f64` runs the same checks under
 * `--number-mode f64`.
 */
export const serverChecks = (): i32 => {
  const t = new Suite("http1 server");
  const lb = new H1Loop(testConfig(), tcpConfig([H1_ALPN, "h2"]), 4, ZERO, ZERO);
  const get: string = "GET /hello HTTP/1.1\r\nHost: a\r\n\r\n";

  // --- 1. Plain TCP ----------------------------------------------------------------------------
  const a: i32 = lb.connect(false);
  lb.send(a, ascii(get));
  const hello = lb.response(a, false);
  t.eqStr(
    "a GET is answered with its length, byte for byte",
    `${hello.head}\r\n${hello.text()}`,
    "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 26\r\n\r\nhello from nish/net/http1\n"
  );

  const post: u8[] = ascii("POST /echo HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked\r\n\r\n5;x=y\r\nhello\r\n6\r\n world\r\n0\r\n\r\n");
  const postLength: i32 = toI32(post.length);
  let badCut: i32 = -1;
  for (let cut: i32 = 1; cut < postLength && badCut < 0; cut++) {
    lb.sendRange(a, post, ZERO, cut);
    lb.settle();
    lb.sendRange(a, post, cut, postLength);
    const r = lb.response(a, false);
    if (r.status !== 200 || r.text() !== "hello world" || !r.has("Transfer-Encoding: chunked")) {
      badCut = cut;
    }
  }
  t.eqI32("a chunked POST cut in two at every byte is echoed whole every time", badCut, toI32(-1));
  for (let k: i32 = 0; k < postLength; k++) {
    lb.sendRange(a, post, k, k + 1);
    lb.settle();
  }
  t.eqStr("and so is one sent a byte at a time", lb.response(a, false).text(), "hello world");

  lb.send(a, ascii(`${get}POST /echo HTTP/1.1\r\nHost: a\r\nContent-Length: 5\r\n\r\nabcde`));
  const first = lb.response(a, false);
  const second = lb.response(a, false);
  t.eqStr("a pipelined pair is answered in order", `${first.text()}|${second.text()}`, "hello from nish/net/http1\n|abcde");

  const bigBody: u8[] = patterned(BIG_SIZE);
  lb.send(a, ascii(`POST /echo HTTP/1.1\r\nHost: a\r\nContent-Length: ${BIG_SIZE}\r\n\r\n`));
  const upload = new ClientReader(false);
  upload.keep = false;
  for (let at: i32 = 0; at < BIG_SIZE; at += 65536) {
    lb.sendRange(a, bigBody, at, at + 65536 < BIG_SIZE ? at + 65536 : BIG_SIZE);
  }
  lb.read(a, upload);
  lb.peers[a].take(upload.pos);
  t.ok(
    "a 2 MiB body with a length streams through 4 KiB chunks and an 8 KiB output and comes back whole",
    upload.done && upload.received === BIG_SIZE && !upload.patternMismatch && upload.chunks > 1
  );
  t.ok(`and no H1_BODY was larger than chunkSize (${lb.app.largestChunk} bytes)`, lb.app.largestChunk > 0 && lb.app.largestChunk <= 4096);

  const chunkedParts: u8[][] = [ascii("POST /echo HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked\r\n\r\n")];
  const piece: u8[] = patterned(toI32(1000));
  for (let k: i32 = 0; k < 300; k++) {
    chunkedParts.push(ascii("3e8\r\n"));
    chunkedParts.push(piece);
    chunkedParts.push(ascii("\r\n"));
  }
  chunkedParts.push(ascii("0\r\n\r\n"));
  lb.send(a, join(chunkedParts));
  const chunkedEcho = lb.response(a, false);
  let same: boolean = chunkedEcho.done && toI32(chunkedEcho.body.length) === 300000;
  for (let k: i32 = 0; k < toI32(chunkedEcho.body.length) && same; k++) {
    same = chunkedEcho.body[k] === piece[k % 1000];
  }
  t.ok("three hundred chunks in come back as chunks", same);

  lb.send(a, ascii("GET /big HTTP/1.1\r\nHost: a\r\n\r\n"));
  const big = new ClientReader(false);
  big.keep = false;
  lb.read(a, big);
  lb.peers[a].take(big.pos);
  t.ok(
    "a 2 MiB chunked response goes out through an 8 KiB output as the socket drains",
    big.done && big.received === BIG_SIZE && !big.patternMismatch && big.chunks > 1
  );

  lb.send(a, ascii(`HEAD /hello HTTP/1.1\r\nHost: a\r\n\r\n${get}`));
  const head = lb.response(a, true);
  t.ok("HEAD has the length of the GET and no body", head.status === 200 && head.has("Content-Length: 26"));
  t.eqStr("so the next response on the connection is read right", lb.response(a, false).text(), "hello from nish/net/http1\n");

  lb.send(a, ascii("POST /echo HTTP/1.1\r\nHost: a\r\nExpect: 100-continue\r\nContent-Length: 5\r\n\r\n"));
  const proceed = lb.response(a, false);
  t.eqStr("Expect: 100-continue is answered with 100 before the body is sent", proceed.head, "HTTP/1.1 100 Continue\r\n");
  lb.send(a, ascii("fghij"));
  t.eqStr("and then the final response", lb.response(a, false).text(), "fghij");

  lb.send(a, ascii(`GET /hello HTTP/1.1\r\nHost: a\r\nConnection: upgrade\r\nUpgrade: websocket\r\n\r\n${get}`));
  const declined = lb.response(a, false);
  t.ok("an upgrade the program answers without switching is a plain response", declined.status === 200 && !declined.has("Connection: close"));
  t.eqStr("and the next request on the connection is HTTP again", lb.response(a, false).text(), "hello from nish/net/http1\n");

  lb.send(a, ascii("GET /missing HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n"));
  const missing = lb.response(a, false);
  t.ok("a request with Connection: close is answered with it", missing.status === 404 && missing.has("Connection: close"));
  t.ok("and the server closes the connection", lb.awaitEnd(a));

  const old: i32 = lb.connect(false);
  lb.send(old, ascii("GET /hello HTTP/1.0\r\nConnection: keep-alive\r\n\r\n"));
  const keep10 = lb.response(old, false);
  t.ok("an HTTP/1.0 request asking for keep-alive gets it", keep10.has("Connection: keep-alive") && keep10.text() === "hello from nish/net/http1\n");
  lb.send(old, ascii("POST /echo HTTP/1.0\r\nConnection: keep-alive\r\nContent-Length: 4\r\n\r\nold!"));
  const unframed = lb.response(old, false);
  t.ok(
    "a chunked response to HTTP/1.0 is sent unframed and ends with the connection",
    unframed.done && unframed.text() === "old!" && unframed.has("Connection: close") && !unframed.has("Transfer-Encoding: chunked")
  );
  const plain10: i32 = lb.connect(false);
  lb.send(plain10, ascii("GET /hello HTTP/1.0\r\n\r\n"));
  t.ok("an HTTP/1.0 request without keep-alive gets Connection: close and a close", lb.response(plain10, false).has("Connection: close") && lb.awaitEnd(plain10));

  // --- 2. WebSocket over the upgrade --------------------------------------------------------------
  const w: i32 = lb.connect(false);
  const handshake: string =
    "GET /ws HTTP/1.1\r\nHost: a\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n";
  lb.send(w, join([ascii(handshake), clientFrame(WS_OP_TEXT, ascii("Hello"))]));
  const switched = lb.response(w, false);
  t.ok(
    "the opening handshake is answered with 101 and RFC 6455 §1.3's accept key",
    switched.status === 101 && switched.has("Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=") && switched.has("Upgrade: websocket")
  );
  const d = new WsDecoder(false, 1048576);
  t.ok("a frame sent with the handshake is echoed, unmasked", wsEvent(lb, w, d) === WS_MESSAGE && d.opcode === WS_OP_TEXT && d.dataLen === 5);
  const binary: u8[] = patterned(toI32(5000));
  lb.send(w, join([clientFrame(WS_OP_PING, ascii("p")), clientFrame(WS_OP_BINARY, binary)]));
  t.ok("a ping is answered with a pong carrying its payload", wsEvent(lb, w, d) === WS_PONG && d.dataLen === 1 && d.data[0] === toU8(112));
  t.ok("a 5000-byte binary message is echoed", wsEvent(lb, w, d) === WS_MESSAGE && d.opcode === WS_OP_BINARY && d.dataLen === 5000 && d.data[4999] === binary[4999]);
  const bye: u8[] | null = websocketClosePayload(toI32(1000), "bye");
  lb.send(w, clientFrame(WS_OP_CLOSE, bye === null ? [] : bye));
  t.ok("a close is answered with a close of its code", wsEvent(lb, w, d) === WS_CLOSE && d.closeCode === 1000);
  t.ok("and the server closes the connection", lb.awaitEnd(w) && lb.app.closeStatus === 1000);

  const w2: i32 = lb.connect(false);
  const unmasked: u8[] | null = websocketFrame(true, WS_OP_TEXT, ascii("x"), ZERO, toI32(1), null);
  lb.send(w2, join([ascii(handshake), unmasked === null ? [] : unmasked]));
  lb.response(w2, false);
  const d2 = new WsDecoder(false, 1048576);
  t.ok("an unmasked frame from a client is answered with close 1002", wsEvent(lb, w2, d2) === WS_CLOSE && d2.closeCode === 1002);
  t.ok("and the connection ends, H1_ERROR telling the program", lb.awaitEnd(w2) && lb.app.errorStatus === 1002);

  const w3: i32 = lb.connect(false);
  lb.send(w3, join([ascii(handshake), clientFrame(WS_OP_BINARY, patterned(toI32(140000)))]));
  lb.response(w3, false);
  const d3 = new WsDecoder(false, 1048576);
  t.ok("a message past maxMessage is answered with close 1009", wsEvent(lb, w3, d3) === WS_CLOSE && d3.closeCode === 1009 && lb.awaitEnd(w3));

  const w4: i32 = lb.connect(false);
  lb.send(w4, ascii("GET /ws HTTP/1.1\r\nHost: a\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 8\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n"));
  t.eqI32("a handshake the server cannot accept gets the program's 400", lb.response(w4, false).status, toI32(400));
  lb.hangUp(w4);

  // --- 3. A warmed slot, the arena flat ----------------------------------------------------------
  const warm: i32 = lb.connect(false);
  const exchange: u8[] = ascii(`${get}POST /echo HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nwarm\r\n0\r\n\r\n`);
  for (let k: i32 = 0; k < 4; k++) {
    lb.send(warm, exchange);
    lb.response(warm, false);
    lb.response(warm, false);
  }
  lb.measuring = true;
  let answered: i32 = 0;
  for (let k: i32 = 0; k < 100; k++) {
    lb.send(warm, exchange);
    if (lb.response(warm, false).status === 200 && lb.response(warm, false).text() === "warm") {
      answered = answered + 1;
    }
  }
  lb.measuring = false;
  t.eqI32("a warmed slot answers a hundred GETs and a hundred chunked POSTs", answered, toI32(100));
  t.ok(`and the server's calls and its program's answers moved the arena not at all (${lb.growth} bytes)`, lb.growth === toI64(0));
  lb.hangUp(warm);

  // --- 4. The refusals ----------------------------------------------------------------------------
  const bigField: string[] = [];
  for (let k: i32 = 0; k < 1100; k++) {
    bigField.push("x");
  }
  const longTarget: string[] = [];
  for (let k: i32 = 0; k < 300; k++) {
    longTarget.push("a");
  }
  t.eqI32("refused with 431: a header section past maxHeaderBytes", statusFor(lb, `GET / HTTP/1.1\r\nHost: a\r\nX-Big: ${bigField.join("")}\r\n\r\n`), toI32(431));
  t.eqI32("refused with 400: a chunk size that is not hex", statusFor(lb, "POST /sink HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked\r\n\r\nzz\r\nhello\r\n0\r\n\r\n"), toI32(400));
  const midway: i32 = lb.connect(false);
  lb.send(midway, ascii("POST /echo HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nok\r\nzz\r\n"));
  const cutShort = lb.response(midway, false);
  t.ok(
    "a bad chunk size once the response has started: no second response, and the connection ends",
    cutShort.status === 200 && !cutShort.done && cutShort.text() === "ok" && lb.peers[midway].ended
  );
  t.eqI32(
    "refused with 400: Content-Length and Transfer-Encoding together (RFC 9112 §6.1)",
    statusFor(lb, "POST /echo HTTP/1.1\r\nHost: a\r\nContent-Length: 5\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n"),
    toI32(400)
  );
  t.eqI32(
    "refused with 400: two Content-Length fields that disagree",
    statusFor(lb, "POST /echo HTTP/1.1\r\nHost: a\r\nContent-Length: 5\r\nContent-Length: 6\r\n\r\nabcdef"),
    toI32(400)
  );
  t.eqI32("refused with 400: an obs-fold", statusFor(lb, "GET / HTTP/1.1\r\nHost: a\r\nX: y\r\n z\r\n\r\n"), toI32(400));
  t.eqI32("refused with 414: a target past maxTarget", statusFor(lb, `GET /${longTarget.join("")} HTTP/1.1\r\nHost: a\r\n\r\n`), toI32(414));
  t.eqI32("refused with 413: a Content-Length past maxBody", statusFor(lb, "POST /echo HTTP/1.1\r\nHost: a\r\nContent-Length: 99999999\r\n\r\n"), toI32(413));
  t.eqI32("refused with 501: a transfer coding other than chunked", statusFor(lb, "POST /echo HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: gzip, chunked\r\n\r\n0\r\n\r\n"), toI32(501));
  t.eqI32("refused with 505: HTTP/2.0 in a request line", statusFor(lb, "GET / HTTP/2.0\r\nHost: a\r\n\r\n"), toI32(505));
  const after: i32 = lb.connect(false);
  lb.send(after, ascii(`${get}GET / HTTP/1.1\r\n\r\n`));
  const good = lb.response(after, false);
  const bad = lb.response(after, false);
  t.ok("a refusal after a good pipelined request: the good one is answered first", good.status === 200 && bad.status === 400 && lb.awaitEnd(after));

  // --- 5. Ends, the clock and the pool ---------------------------------------------------------------
  const closedBefore: i32 = lb.closed;
  const cut: i32 = lb.connect(false);
  lb.send(cut, ascii("POST /echo HTTP/1.1\r\nHost: a\r\nContent-Length: 10\r\n\r\nabc"));
  lb.settle();
  netShutdown(lb.peers[cut].fd, toI32(1));
  t.ok("a request cut short by the end of the stream ends the connection", lb.awaitEnd(cut) && lb.awaitClosed(closedBefore + 1));
  lb.hangUp(cut);

  const gone: i32 = lb.connect(false);
  lb.send(gone, ascii("GET /big HTTP/1.1\r\nHost: a\r\n\r\n"));
  lb.awaitBytes(gone, toI32(100));
  lb.hangUp(gone);
  t.ok("a client gone in the middle of a response: the write fails and the slot is closed", lb.awaitClosed(closedBefore + 2));

  lb.settle();
  const idle: i32 = lb.connect(false);
  lb.settle();
  t.eqI32("a slot that has just moved is not idle", lb.plain.expire(monotonicNanos()), ZERO);
  t.eqI32("past idleTimeout it is closed", lb.plain.expire(monotonicNanos() + toI64(2000000000)), toI32(1));
  t.ok("and its client sees the end", lb.awaitEnd(idle) && lb.plain.busy() === 0);

  const pool: i32[] = [];
  for (let k: i32 = 0; k < 4; k++) {
    pool.push(lb.connect(false));
  }
  lb.settle();
  t.eqI32("four clients fill the pool", lb.plain.busy(), toI32(4));
  const refusedBefore: i32 = lb.refused;
  const shed: i32 = lb.connect(false);
  t.ok("a fifth is accepted and shed", lb.awaitEnd(shed) && lb.refused === refusedBefore + 1);
  for (const k of pool) {
    lb.send(k, ascii("GET /hello HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n"));
    lb.response(k, false);
  }
  lb.settle();
  t.ok("and they all close", lb.plain.busy() === 0);
  t.ok(
    "a free slot answers H1_ERROR to next and done to the rest",
    lb.plain.next(ZERO) === H1_ERROR && (lb.plain.flush(ZERO) & H1_DONE) !== 0 && (lb.plain.readable(ZERO) & H1_DONE) !== 0 && lb.plain.fd(ZERO) === -1 && !lb.plain.holds(toI32(9))
  );
  t.ok("a slot out of range names the first connection", lb.plain.connection(toI32(9)) === lb.plain.connection(ZERO) && lb.plain.size() === 4);

  // --- 6. TLS -------------------------------------------------------------------------------------
  const s = new TlsClient(lb);
  t.ok("a client offering http/1.1 completes the handshake, the server's signature and Finished verified", s.handshake([H1_ALPN]) && s.verified);
  t.eqStr("ALPN chose http/1.1", lb.secure.alpn(ZERO), "http/1.1");
  s.send(get);
  t.eqStr("a GET over TLS", s.response(new ClientReader(false)).text(), "hello from nish/net/http1\n");
  const tlsExchange: string = `${get}POST /echo HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nwarm\r\n0\r\n\r\n`;
  s.send(tlsExchange);
  s.response(new ClientReader(false));
  t.eqStr("a chunked POST echoed over TLS", s.response(new ClientReader(false)).text(), "warm");
  lb.growth = 0;
  lb.measuring = true;
  let tlsAnswered: i32 = 0;
  for (let k: i32 = 0; k < 50; k++) {
    s.send(tlsExchange);
    if (s.response(new ClientReader(false)).status === 200 && s.response(new ClientReader(false)).text() === "warm") {
      tlsAnswered = tlsAnswered + 1;
    }
  }
  lb.measuring = false;
  t.eqI32("fifty exchanges over TLS on the warmed slot", tlsAnswered, toI32(50));
  t.ok(`and the arena did not move (${lb.growth} bytes)`, lb.growth === toI64(0));
  s.send("GET /hello HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n");
  s.response(new ClientReader(false));
  s.response(new ClientReader(false));
  t.ok("Connection: close over TLS ends with close_notify", s.alerts.join(",") === "1 0" && lb.awaitEnd(s.index));

  const n = new TlsClient(lb);
  const noAlpn: string[] = [];
  t.ok("a client offering no ALPN completes the handshake", n.handshake(noAlpn));
  n.send(get);
  t.eqStr("and is served HTTP/1.1", n.response(new ClientReader(false)).text(), "hello from nish/net/http1\n");
  lb.settle();
  t.eqI32("an idle TLS slot is closed past idleTimeout", lb.secure.expire(monotonicNanos() + toI64(2000000000)), toI32(1));
  t.ok("and its client sees the end", lb.awaitEnd(n.index) && lb.secure.busy() === 0);

  const h = new TlsClient(lb);
  t.ok("a client offering only h2 completes the handshake", h.handshake(["h2"]));
  h.send(get);
  const refusedResponse = h.response(new ClientReader(false));
  t.ok("but ALPN h2 is shut down with close_notify, before any HTTP/1.1 byte", !refusedResponse.done && h.alerts.join(",") === "1 0" && toI32(h.plain.length) === 0);
  lb.settle();
  t.ok("and closed", lb.secure.busy() === 0 && lb.secure.size() === 4);
  t.ok(
    "a free TLS slot answers H1_ERROR to next and done to flush",
    lb.secure.next(ZERO) === H1_ERROR && (lb.secure.flush(ZERO) & 16) !== 0 && lb.secure.fd(ZERO) === -1 && lb.secure.connection(toI32(9)) === lb.secure.connection(ZERO)
  );
  t.eqStr("with nothing gone wrong in the loop", lb.failure, "");
  lb.shutdown();

  // --- 7. The connection alone ---------------------------------------------------------------------
  const config: Http1Config = testConfig();
  config.outputSize = 1024;
  const none: u8[][] = [];
  const fresh = new Http1Connection(config);
  t.eqI32("respond with no request is H1_CLOSED", fresh.respond(toI32(200), none, none, ZERO), H1_CLOSED);
  t.eqI32("so are write and end", fresh.write(ascii("x"), ZERO, toI32(1)) + fresh.end(), H1_CLOSED + H1_CLOSED);
  t.eqI32("so is acceptWebSocket", fresh.acceptWebSocket(""), H1_CLOSED);
  t.eqI32("and sendFrame and closeWebSocket on a slot that is not a WebSocket", fresh.sendFrame(true, WS_OP_TEXT, ascii("x"), ZERO, toI32(1)) + fresh.closeWebSocket(toI32(1000)), H1_CLOSED + H1_CLOSED);
  t.eqI32("an empty connection needs more", fresh.next(), H1_NEED_MORE);

  const g = new Driven(config, get);
  t.eqI32("a request reaches the program", g.event, H1_REQUEST);
  t.eqI32("refused: status 101 through respond", g.conn.respond(toI32(101), none, none, HTTP1_NO_BODY), H1_INVALID);
  t.eqI32("refused: status 99", g.conn.respond(toI32(99), none, none, ZERO), H1_INVALID);
  t.eqI32("refused: status 600", g.conn.respond(toI32(600), none, none, ZERO), H1_INVALID);
  t.eqI32("refused: a Connection field of the program's", g.conn.respond(toI32(200), [ascii("Connection")], [ascii("close")], ZERO), H1_INVALID);
  t.eqI32("refused: an Upgrade field", g.conn.respond(toI32(200), [ascii("upgrade")], [ascii("x")], ZERO), H1_INVALID);
  t.eqI32("refused: a CR in a value", g.conn.respond(toI32(200), [ascii("x")], [ascii("a\rb")], ZERO), H1_INVALID);
  t.eqI32("refused: no body on a 200 to a GET", g.conn.respond(toI32(200), none, none, HTTP1_NO_BODY), H1_INVALID);
  const huge: string[] = [];
  for (let k: i32 = 0; k < 900; k++) {
    huge.push("v");
  }
  t.eqI32("refused: a head larger than the output", g.conn.respond(toI32(200), [ascii("x")], [ascii(huge.join(""))], ZERO), H1_INVALID);
  t.eqI32("refused: acceptWebSocket on a request that is not a handshake", g.conn.acceptWebSocket(""), H1_INVALID);
  t.eqI32("nothing was written by any of them", g.conn.outputEnd, ZERO);
  t.eqI32("a response with a length", g.conn.respond(toI32(200), none, none, toI32(3)), ZERO);
  t.eqI32("refused: a second response", g.conn.respond(toI32(200), none, none, ZERO), H1_CLOSED);
  t.eqI32("refused: more body than the length", g.conn.write(ascii("abcd"), ZERO, toI32(4)), H1_INVALID);
  t.eqI32("refused: end while the length is owed", g.conn.end(), H1_INVALID);
  t.eqI32("an empty write takes nothing", g.conn.write(ascii("abc"), ZERO, ZERO), ZERO);
  t.eqI32("the body", g.conn.write(ascii("abc"), ZERO, toI32(3)), toI32(3));
  t.eqI32("the end", g.conn.end(), ZERO);
  t.eqI32("the request ends after", g.conn.next(), H1_END);
  t.eqI32("refused: end twice", g.conn.end(), H1_CLOSED);
  t.eqStr("what it sent", sent(g.conn), "HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nabc");

  // A 700-byte response left unsent, then a pipelined request: no room for its head.
  const p = new Driven(config, `${get}${get}`);
  p.conn.respond(toI32(200), none, none, toI32(700));
  p.conn.write(patterned(toI32(700)), ZERO, toI32(700));
  p.conn.end();
  t.ok("the next pipelined request is read once the first is answered", p.conn.next() === H1_END && p.conn.next() === H1_REQUEST);
  t.eqI32("its head does not fit beside the unsent response: H1_AGAIN", p.conn.respond(toI32(200), none, none, ZERO), H1_AGAIN);
  t.eqI32("and the connection waits for the output", p.conn.next(), H1_NEED_MORE);
  t.eqI32("feed takes nothing while a write is held", p.conn.feed(ascii(get), ZERO, toI32(5)), ZERO);
  p.conn.consume(toI32(200));
  t.eqI32("until half the output is free", p.conn.next(), H1_NEED_MORE);
  p.conn.consume(toI32(1000));
  t.eqI32("then H1_WRITE", p.conn.next(), H1_WRITE);
  t.eqI32("and the head goes", p.conn.respond(toI32(200), none, none, ZERO), ZERO);

  // A chunked head that leaves less than the last chunk's five bytes.
  const tightValue: string[] = [];
  for (let k: i32 = 0; k < 714; k++) {
    tightValue.push("t");
  }
  const e = new Driven(config, get);
  t.eqI32("a chunked head that fills the output to four bytes", e.conn.respond(toI32(200), [ascii("x")], [ascii(tightValue.join(""))], HTTP1_CHUNKED), ZERO);
  t.eqI32("a write that cannot fit a chunk is H1_AGAIN", e.conn.write(ascii("abc"), ZERO, toI32(3)), H1_AGAIN);
  t.eqI32("and so is the last chunk", e.conn.end(), H1_AGAIN);
  e.conn.consume(toI32(2000));
  t.eqI32("H1_WRITE once it drains", e.conn.next(), H1_WRITE);
  t.eqI32("a write that only partly fits takes what fits", e.conn.write(patterned(toI32(800)), ZERO, toI32(800)), toI32(756));
  t.eqI32("and the last chunk still fits beside it", e.conn.end(), ZERO);

  const headRequest = new Driven(config, "HEAD /x HTTP/1.1\r\nHost: a\r\n\r\n");
  headRequest.conn.respond(toI32(200), none, none, HTTP1_CHUNKED);
  t.eqI32("a write to a response to HEAD takes everything", headRequest.conn.write(ascii("dropped"), ZERO, toI32(7)), toI32(7));
  headRequest.conn.end();
  t.eqStr("and sends no body, not even the last chunk", sent(headRequest.conn), "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n");
  const noContent = new Driven(config, get);
  t.ok("a 204 takes HTTP1_NO_BODY", noContent.conn.respond(toI32(204), none, none, HTTP1_NO_BODY) === 0 && noContent.conn.end() === 0);
  const toClose = new Driven(config, "GET / HTTP/1.0\r\n\r\n");
  toClose.conn.respond(toI32(200), none, none, HTTP1_CHUNKED);
  toClose.conn.write(ascii("to the close"), ZERO, toI32(12));
  toClose.conn.end();
  toClose.conn.next();
  t.ok("a body sent to the close ends the connection with its exchange", toClose.conn.next() === H1_NEED_MORE && toClose.conn.isDone() === false);
  sent(toClose.conn);
  t.ok("once sent", toClose.conn.isDone());

  const refusal = new Driven(config, "GET / HTTP/1.1\r\n\r\n");
  t.ok(
    "a refused request is H1_ERROR with its status, and the response is queued",
    refusal.event === H1_ERROR && refusal.conn.status === 400 && outputStatus(refusal.conn) === 400
  );
  t.ok("H1_ERROR is final and nothing more is read", refusal.conn.next() === H1_ERROR && refusal.conn.inputRoom() === 0 && refusal.conn.respond(toI32(200), none, none, ZERO) === H1_CLOSED);

  const ws = new Driven(config, handshake);
  t.eqI32("refused: a protocol that is not a token", ws.conn.acceptWebSocket("a\r\nb"), H1_INVALID);
  t.eqI32("the handshake is accepted", ws.conn.acceptWebSocket("chat"), ZERO);
  t.eqI32("refused: answering it twice", ws.conn.respond(toI32(200), none, none, ZERO), H1_CLOSED);
  t.ok("the slot reads frames once the request has ended", ws.conn.next() === H1_END && ws.conn.next() === H1_NEED_MORE && ws.conn.isWebSocket());
  t.ok("the 101 names the protocol", toI32(sent(ws.conn).indexOf("\r\nSec-WebSocket-Protocol: chat\r\n")) > 0);
  t.eqI32("refused: sendFrame with a close", ws.conn.sendFrame(true, WS_OP_CLOSE, ascii(""), ZERO, ZERO), H1_INVALID);
  t.eqI32("refused: a frame larger than the output", ws.conn.sendFrame(true, WS_OP_BINARY, patterned(toI32(1000)), ZERO, toI32(1000)), H1_INVALID);
  t.eqI32("refused: a fragmented ping", ws.conn.sendFrame(false, WS_OP_PING, ascii(""), ZERO, ZERO), H1_INVALID);
  t.eqI32("a frame", ws.conn.sendFrame(true, WS_OP_BINARY, patterned(toI32(700)), ZERO, toI32(700)), ZERO);
  t.eqI32("one that does not fit beside it is H1_AGAIN", ws.conn.sendFrame(true, WS_OP_BINARY, patterned(toI32(100)), ZERO, toI32(100)), H1_AGAIN);
  ws.conn.consume(toI32(2000));
  t.eqI32("H1_WRITE once it drains", ws.conn.next(), H1_WRITE);
  const ping: u8[] = clientFrame(WS_OP_PING, ascii("hi"));
  ws.conn.feed(ping, ZERO, toI32(ping.length));
  t.ok("a ping is answered by the connection", ws.conn.next() === H1_NEED_MORE && sentHex(ws.conn) === "8a026869");
  const pong: u8[] = clientFrame(WS_OP_PONG, ascii("hi"));
  const text: u8[] = clientFrame(WS_OP_TEXT, ascii("yo"));
  ws.conn.feed(join([pong, text]), ZERO, toI32(pong.length + text.length));
  t.ok("a pong is read past, and a message reaches the program", ws.conn.next() === H1_WS_MESSAGE && ws.conn.dataLength === 2 && ws.conn.opcode === WS_OP_TEXT);
  t.eqI32("refused: closeWebSocket with 1005", ws.conn.closeWebSocket(WS_CLOSE_NO_STATUS), H1_INVALID);
  t.eqI32("closeWebSocket sends the close", ws.conn.closeWebSocket(toI32(1001)), ZERO);
  t.ok("and the connection is done once it is sent", sentHex(ws.conn) === "880203e9" && ws.conn.isDone() && ws.conn.next() === H1_NEED_MORE);

  const wsEnd = new Driven(config, handshake);
  wsEnd.conn.acceptWebSocket("");
  wsEnd.conn.next();
  wsEnd.conn.next();
  wsEnd.conn.endInput();
  t.ok("a WebSocket whose stream ends is done", wsEnd.conn.next() === H1_NEED_MORE && sent(wsEnd.conn) !== "" && wsEnd.conn.isDone());
  const wsPeerClose = new Driven(config, handshake);
  wsPeerClose.conn.acceptWebSocket("");
  wsPeerClose.conn.next();
  wsPeerClose.conn.next();
  sent(wsPeerClose.conn);
  const empty: u8[] = clientFrame(WS_OP_CLOSE, ascii(""));
  wsPeerClose.conn.feed(empty, ZERO, toI32(empty.length));
  t.ok(
    "a close with no status is H1_WS_CLOSE with 1005, answered with an empty close",
    wsPeerClose.conn.next() === H1_WS_CLOSE && wsPeerClose.conn.status === 1005 && sentHex(wsPeerClose.conn) === "8800"
  );

  const aborted = new Driven(config, get);
  aborted.conn.abort();
  t.ok("an aborted connection is done at once", aborted.conn.isDone() && aborted.conn.next() === H1_ERROR);

  const body = new Driven(config, "POST / HTTP/1.1\r\nHost: a\r\nContent-Length: 4\r\n\r\nab");
  t.ok("a body event is a window onto the parser's buffer", body.conn.next() === H1_BODY && body.conn.dataLength === 2);
  body.conn.endInput();
  t.ok("a body cut by the end of the stream ends the connection", body.conn.next() === H1_NEED_MORE && body.conn.isDone());
  return t.done();
};

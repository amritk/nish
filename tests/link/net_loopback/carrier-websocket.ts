// WebSocket over HTTP/1.1 over TLS: the upgrade on `nish/net/http1-server`'s
// TLS pool, answered by `H1App`'s echo, and a Nish client that masks its
// frames with `nish/net/websocket`'s writer and reads the server's with a
// `WsDecoder` of its own. A message the client sends in three fragments with
// a ping between them, a 100,000-byte message each way (the server's output
// is 8,192 bytes, so its echo goes back in fragments), messages on the warm
// connection with the arena measured, and a close with a code.
import { Suite } from "nish/testing";
import { H1_ALPN } from "nish/net/http1-server";
import {
  WS_CLOSE,
  WS_MESSAGE,
  WS_NEED_MORE,
  WS_OP_BINARY,
  WS_OP_CLOSE,
  WS_OP_CONTINUATION,
  WS_OP_PING,
  WS_OP_TEXT,
  WS_PONG,
  WsDecoder,
  websocketClosePayload,
  websocketFrame,
} from "nish/net/websocket";
import { ZERO, ascii, join, range } from "../net_tls_record_common/bytes";
import { h3IsPattern, h3Pattern } from "../net_http3/peer";
import { NqMeter } from "../net_quic_stream/arena";
import { ClientReader } from "../net_http1_server/harness";
import { textOf } from "../crypto_x509/hex";
import { CARRIER_H1, TcpLoop } from "./tcp";
import { TlsClient } from "./tls-client";
import { h1Response } from "./carrier-http1";
import { ROUNDS, WARM, roundText } from "./common";

/** A client frame of `payload[off .. off + len)`, masked with 01 02 03 04 as a client's must be. */
const wsClientFrame = (fin: boolean, opcode: i32, payload: u8[], off: i32, len: i32): u8[] => {
  const mask: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4)];
  const out: u8[] | null = websocketFrame(fin, opcode, payload, off, len, mask);
  return out === null ? [] : out;
};

/** A whole message as one frame. */
const wsWhole = (opcode: i32, payload: u8[]): u8[] => wsClientFrame(true, opcode, payload, ZERO, toI32(payload.length));

/** The next event the client's decoder reads, opening records as they arrive. */
const lbWsEvent = (c: TlsClient, d: WsDecoder): i32 => {
  let event: i32 = d.next();
  while (event === WS_NEED_MORE) {
    if (toI32(c.plain.length) > 0) {
      const got: u8[] = c.take(toI32(c.plain.length));
      d.feed(got, ZERO, toI32(got.length));
    } else if (!c.pump() || toI32(c.alerts.length) > 0) {
      return WS_NEED_MORE;
    }
    event = d.next();
  }
  return event;
};

/** The message the decoder just read, as bytes. */
const wsMessageOf = (d: WsDecoder): u8[] => range(d.data, ZERO, d.dataLen);

/** Every check of the WebSocket carrier. */
export const websocketChecks = (t: Suite): void => {
  const lp = new TcpLoop(CARRIER_H1);
  const c = new TlsClient(lp);
  const shook: boolean = c.handshake([H1_ALPN]);
  c.send(
    ascii(
      "GET /ws HTTP/1.1\r\nHost: loopback\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n"
    )
  );
  const switched: ClientReader = h1Response(c);
  t.ok(
    "websocket: the upgrade over TLS is answered 101 with RFC 6455's accept key",
    shook && switched.status === 101 && switched.has("Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=") && switched.has("Upgrade: websocket")
  );

  const d = new WsDecoder(false, toI32(262144));
  const text: u8[] = ascii("fragmented, with a ping between");
  c.send(
    join([
      wsClientFrame(false, WS_OP_TEXT, text, ZERO, toI32(11)),
      wsClientFrame(true, WS_OP_PING, ascii("p1"), ZERO, toI32(2)),
      wsClientFrame(false, WS_OP_CONTINUATION, text, toI32(11), toI32(6)),
      wsClientFrame(true, WS_OP_CONTINUATION, text, toI32(17), toI32(text.length) - 17),
    ])
  );
  t.ok("websocket: a ping between a message's fragments is answered with a pong of its payload", lbWsEvent(c, d) === WS_PONG && textOf(wsMessageOf(d)) === "p1");
  t.ok(
    "websocket: and the three fragments come back as the one text message",
    lbWsEvent(c, d) === WS_MESSAGE && d.opcode === WS_OP_TEXT && textOf(wsMessageOf(d)) === "fragmented, with a ping between"
  );

  const big: u8[] = h3Pattern(toI32(100000));
  const pieces: u8[][] = [];
  for (let at: i32 = 0; at < 100000; at += 16000) {
    const n: i32 = 100000 - at < 16000 ? 100000 - at : 16000;
    pieces.push(wsClientFrame(at + n === 100000, at === 0 ? WS_OP_BINARY : WS_OP_CONTINUATION, big, at, n));
  }
  const before: i32 = lp.h1App.fragments;
  c.send(join(pieces));
  const back: boolean = lbWsEvent(c, d) === WS_MESSAGE && d.opcode === WS_OP_BINARY && d.dataLen === 100000 && h3IsPattern(wsMessageOf(d));
  t.ok("websocket: a 100,000-byte binary message sent in seven fragments is echoed whole", back);
  t.eqI32("websocket: the server's echo went back in 49 fragments of at most 2,048 bytes, its output being 8,192", lp.h1App.fragments - before, toI32(49));

  c.send(wsWhole(WS_OP_PING, ascii("ping")));
  t.ok("websocket: a ping on its own is answered with a pong", lbWsEvent(c, d) === WS_PONG && textOf(wsMessageOf(d)) === "ping");

  for (let k: i32 = 0; k < WARM; k++) {
    c.send(wsWhole(WS_OP_TEXT, ascii(`warm ${k}`)));
    lbWsEvent(c, d);
  }
  const rounds = new NqMeter(false);
  lp.meter = rounds;
  let intact: i32 = 0;
  for (let k: i32 = 0; k < ROUNDS; k++) {
    const message: string = roundText(k);
    c.send(wsWhole(WS_OP_TEXT, ascii(message)));
    if (lbWsEvent(c, d) === WS_MESSAGE && textOf(wsMessageOf(d)) === message) {
      intact = intact + 1;
    }
  }
  lp.meter = null;
  t.eqI32("websocket: fifty messages on the warm connection, each echoed", intact, ROUNDS);
  t.ok(`websocket: and every server wake kept ${rounds.kept} bytes over them`, rounds.kept === toI64(0));

  const bye: u8[] | null = websocketClosePayload(toI32(4000), "done");
  const none: u8[] = [];
  c.send(wsWhole(WS_OP_CLOSE, bye === null ? none : bye));
  t.ok("websocket: the client's close with code 4000 is answered with a close of that code", lbWsEvent(c, d) === WS_CLOSE && d.closeCode === 4000);
  t.eqI32("websocket: and the server's program saw the client's code", lp.h1App.closeStatus, toI32(4000));
  t.eqStr("websocket: then the server ends TLS with close_notify", c.awaitAlert(), "1 0");
  t.ok("websocket: and closes the slot", lp.awaitEnd(c.index) && lp.awaitClosed(toI32(1)) && lp.busy() === 0);
  t.eqI32("websocket: the program refused nothing", lp.h1App.refusals, ZERO);
  t.eqStr("websocket: with nothing gone wrong in the loop", lp.failure, "");
  lp.shutdown();
};

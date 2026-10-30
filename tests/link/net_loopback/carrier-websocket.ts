// WebSocket over HTTP/1.1, client and server both Nish: `nish/net/http1-server`
// accepts the upgrade and `H1App` echoes; the client is `nish/net/websocket`'s
// own. It draws a fresh 16-byte nonce from `crypto.getRandomValues`, writes
// the request with `websocketUpgradeRequest` offering chat and superchat,
// reads the server's head with `Http1ResponseParser` (told to expect the
// upgrade), checks it with `websocketCheckResponse`, hands what followed the
// head to a `WsDecoder` of its own, and masks every frame with a fresh random
// key. Over TLS the client is `nish/net/tls-tcp`'s `TlsTcpClient`, which
// authenticates the pool's chain itself: a message in three fragments with a
// ping between them, a 100,000-byte message each way (the server's output is
// 8,192 bytes, so its echo goes back in fragments), messages on the warm
// connection with the arena measured, and a close with 1000. Over plain TCP,
// on a second connection with a key of its own: a message and a close.
import { Suite } from "nish/testing";
import { HTTP1_END, HTTP1_NEED_MORE, HTTP1_UPGRADE } from "nish/net/http1";
import { Http1ResponseParser } from "nish/net/http1-client";
import {
  WS_CLOSE,
  WS_HS_OK,
  WS_MESSAGE,
  WS_NEED_MORE,
  WS_OP_BINARY,
  WS_OP_CLOSE,
  WS_OP_CONTINUATION,
  WS_OP_PING,
  WS_OP_TEXT,
  WS_PONG,
  WsDecoder,
  WsHandshake,
  websocketCheckResponse,
  websocketClientKey,
  websocketClosePayload,
  websocketFrame,
  websocketUpgradeRequest,
} from "nish/net/websocket";
import { ZERO, ascii, join, range } from "../net_tls_record_common/bytes";
import { h3IsPattern, h3Pattern } from "../net_http3/peer";
import { textOf } from "../crypto_x509/hex";
import { CARRIER_H1, CARRIER_H1_PLAIN, TcpLoop } from "./tcp";
import { LbMeter, ROUNDS, WARM, roundText } from "./common";

/** A client frame of `payload[off .. off + len)`, masked with a fresh key from `crypto.getRandomValues`, as §5.3 asks. */
const wsClientFrame = (fin: boolean, opcode: i32, payload: u8[], off: i32, len: i32): u8[] => {
  const mask: u8[] = new Array<u8>(4);
  crypto.getRandomValues(mask);
  const out: u8[] | null = websocketFrame(fin, opcode, payload, off, len, mask);
  return out === null ? [] : out;
};

/** A whole message as one frame. */
const wsWhole = (opcode: i32, payload: u8[]): u8[] => wsClientFrame(true, opcode, payload, ZERO, toI32(payload.length));

/**
 * One WebSocket client of the loop: over the loop's `TlsTcpClient`, or over
 * raw client `index`. `open` runs the opening handshake; `key` is the one it
 * sent and `answer` what `websocketCheckResponse` made of the server's reply.
 */
class WsLink {
  lp: TcpLoop;
  tls: boolean;
  index: i32 = -1;
  key: string = "";
  answer: WsHandshake;
  /** The head's events after `websocketCheckResponse`: HTTP1_END, then HTTP1_UPGRADE, as "3 4". */
  after: string = "";
  decoder: WsDecoder;

  constructor(lp: TcpLoop, tls: boolean) {
    this.lp = lp;
    this.tls = tls;
    this.answer = new WsHandshake(toI32(-1), "");
    this.decoder = new WsDecoder(false, toI32(262144));
  }

  /** Writes `bytes` to the server. */
  send(bytes: u8[]): void {
    if (this.tls) {
      this.lp.clientSend(bytes);
    } else {
      this.lp.send(this.index, bytes);
    }
  }

  /** What the server sent next, running the loop until something came; empty at the end of the stream or on a timeout. */
  pull(): u8[] {
    if (this.tls) {
      return this.lp.awaitClientBytes(toI32(1)) ? this.lp.takeClient() : [];
    }
    if (!this.lp.awaitBytes(this.index, toI32(1))) {
      return [];
    }
    return this.lp.peers[this.index].take(toI32(this.lp.peers[this.index].got.length));
  }

  /** Connects, sends the upgrade offering `offered`, and reads and checks the server's head; false when no head came. */
  open(offered: string[]): boolean {
    if (this.tls) {
      if (!this.lp.connectTls()) {
        return false;
      }
    } else {
      this.index = this.lp.connect();
      if (this.index < 0) {
        return false;
      }
    }
    const nonce: u8[] = new Array<u8>(16);
    crypto.getRandomValues(nonce);
    const key: string | null = websocketClientKey(nonce);
    if (key === null) {
      return false;
    }
    this.key = key;
    const request: u8[] | null = websocketUpgradeRequest("localhost", "/ws", key, offered);
    if (request === null) {
      return false;
    }
    this.send(request);
    const response = new Http1ResponseParser(toI32(256), toI32(4096), toI32(32), toI64(1024), toI32(1024));
    response.expect(false, false);
    response.expectUpgrade();
    let event: i32 = response.next();
    while (event === HTTP1_NEED_MORE) {
      const got: u8[] = this.pull();
      if (toI32(got.length) === 0) {
        return false;
      }
      response.feed(got, ZERO, toI32(got.length));
      event = response.next();
    }
    this.answer = websocketCheckResponse(response, key, offered);
    const end: i32 = response.next();
    const upgrade: i32 = response.next();
    this.after = `${end} ${upgrade}`;
    // Whatever came past the head is the server's first frames: the decoder's, not HTTP's.
    const tunnel: u8[] = response.tunnelBytes();
    this.decoder.feed(tunnel, ZERO, toI32(tunnel.length));
    return true;
  }

  /** The next event the client's decoder reads, pulling bytes as they arrive. */
  event(): i32 {
    let event: i32 = this.decoder.next();
    while (event === WS_NEED_MORE) {
      const got: u8[] = this.pull();
      if (toI32(got.length) === 0) {
        return WS_NEED_MORE;
      }
      this.decoder.feed(got, ZERO, toI32(got.length));
      event = this.decoder.next();
    }
    return event;
  }

  /** The message the decoder just read, as bytes. */
  message(): u8[] {
    return range(this.decoder.data, ZERO, this.decoder.dataLen);
  }
}

/** The client's close with 1000, "done". */
const closeFrame = (): u8[] => {
  const bye: u8[] | null = websocketClosePayload(toI32(1000), "done");
  const none: u8[] = [];
  return wsWhole(WS_OP_CLOSE, bye === null ? none : bye);
};

/** Every check of the WebSocket carrier. */
export const websocketChecks = (t: Suite): void => {
  const offered: string[] = ["chat", "superchat"];
  const lp = new TcpLoop(CARRIER_H1);
  const c = new WsLink(lp, true);
  const opened: boolean = c.open(offered);
  t.ok("websocket: nish/net/tls-tcp's client authenticates the pool's chain and reads a head to its upgrade", opened);
  t.eqI32("websocket: websocketCheckResponse accepts the 101 and its accept for the random key", c.answer.error, WS_HS_OK);
  t.eqStr("websocket: of chat and superchat, the server chose superchat", c.answer.protocol, "superchat");
  t.eqStr("websocket: and the parser ends the head and hands over the tunnel", c.after, `${HTTP1_END} ${HTTP1_UPGRADE}`);

  const text: u8[] = ascii("fragmented, with a ping between");
  c.send(
    join([
      wsClientFrame(false, WS_OP_TEXT, text, ZERO, toI32(11)),
      wsClientFrame(true, WS_OP_PING, ascii("p1"), ZERO, toI32(2)),
      wsClientFrame(false, WS_OP_CONTINUATION, text, toI32(11), toI32(6)),
      wsClientFrame(true, WS_OP_CONTINUATION, text, toI32(17), toI32(text.length) - 17),
    ])
  );
  t.ok("websocket: a ping between a message's fragments is answered with a pong of its payload", c.event() === WS_PONG && textOf(c.message()) === "p1");
  t.ok(
    "websocket: and the three fragments come back as the one text message",
    c.event() === WS_MESSAGE && c.decoder.opcode === WS_OP_TEXT && textOf(c.message()) === "fragmented, with a ping between"
  );

  const big: u8[] = h3Pattern(toI32(100000));
  const pieces: u8[][] = [];
  for (let at: i32 = 0; at < 100000; at += 16000) {
    const n: i32 = 100000 - at < 16000 ? 100000 - at : 16000;
    pieces.push(wsClientFrame(at + n === 100000, at === 0 ? WS_OP_BINARY : WS_OP_CONTINUATION, big, at, n));
  }
  const before: i32 = lp.h1App.fragments;
  c.send(join(pieces));
  const back: boolean = c.event() === WS_MESSAGE && c.decoder.opcode === WS_OP_BINARY && c.decoder.dataLen === 100000 && h3IsPattern(c.message());
  t.ok("websocket: a 100,000-byte binary message sent in seven fragments is echoed whole", back);
  t.eqI32("websocket: the server's echo went back in 49 fragments of at most 2,048 bytes, its output being 8,192", lp.h1App.fragments - before, toI32(49));

  c.send(wsWhole(WS_OP_PING, ascii("ping")));
  t.ok("websocket: a ping on its own is answered with a pong", c.event() === WS_PONG && textOf(c.message()) === "ping");

  for (let k: i32 = 0; k < WARM; k++) {
    c.send(wsWhole(WS_OP_TEXT, ascii(`warm ${k}`)));
    c.event();
  }
  const rounds = new LbMeter(false);
  lp.meter = rounds;
  let intact: i32 = 0;
  for (let k: i32 = 0; k < ROUNDS; k++) {
    const message: string = roundText(k);
    c.send(wsWhole(WS_OP_TEXT, ascii(message)));
    if (c.event() === WS_MESSAGE && textOf(c.message()) === message) {
      intact = intact + 1;
    }
  }
  lp.meter = null;
  t.eqI32("websocket: fifty messages on the warm connection, each echoed", intact, ROUNDS);
  t.ok(`websocket: and every server wake kept ${rounds.kept} bytes over them`, rounds.kept === toI64(0));

  c.send(closeFrame());
  t.ok("websocket: the client's close with 1000 is answered with a close of that code", c.event() === WS_CLOSE && c.decoder.closeCode === 1000);
  t.eqI32("websocket: and the server's program saw the client's code", lp.h1App.closeStatus, toI32(1000));
  t.ok("websocket: then the server ends TLS with close_notify, and the client answers with its own", lp.awaitClientDone() && lp.clientEnded);
  t.ok("websocket: and the server closes the slot", lp.awaitClosed(toI32(1)) && lp.busy() === 0);
  t.eqI32("websocket: the program refused nothing", lp.h1App.refusals, ZERO);
  t.eqStr("websocket: with nothing gone wrong in the loop", lp.failure, "");
  lp.shutdown();

  const plain = new TcpLoop(CARRIER_H1_PLAIN);
  const p = new WsLink(plain, false);
  const plainOpened: boolean = p.open(offered);
  t.ok("websocket: over plain TCP, the client reads a head to its upgrade", plainOpened);
  t.eqStr("websocket: which is accepted, superchat chosen", `${p.answer.error} ${p.answer.protocol}`, `${WS_HS_OK} superchat`);
  t.ok("websocket: the second connection drew a key of its own", p.key !== c.key && toI32(p.key.length) === 24);
  p.send(wsWhole(WS_OP_TEXT, ascii("plain")));
  t.ok("websocket: a message over plain TCP is echoed", p.event() === WS_MESSAGE && textOf(p.message()) === "plain");
  p.send(closeFrame());
  t.ok("websocket: the close with 1000 is answered in kind", p.event() === WS_CLOSE && p.decoder.closeCode === 1000);
  t.ok("websocket: then the server ends the stream, not a reset", plain.awaitEnd(p.index) && plain.peers[p.index].failure === 0);
  plain.hangUp(p.index);
  t.ok("websocket: and closes the slot", plain.awaitClosed(toI32(1)) && plain.busy() === 0);
  t.eqStr("websocket: with nothing gone wrong in the plain loop", `${plain.h1App.refusals} ${plain.failure}`, "0 ");
  plain.shutdown();
};

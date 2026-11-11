// The interop server's WebSocket echo port, for the Autobahn TestSuite's
// fuzzingclient (`.github/workflows/interop.yml`, job `autobahn`): plain
// HTTP/1.1 that accepts the opening handshake on any target and echoes every
// message whole, text as text and binary as binary. `H1Loop`'s `/ws` echoes a
// message as one frame, so under `testConfig`'s 8 KiB output it drops anything
// longer, and its messages stop at 128 KiB; Autobahn's cases 9.* send up to
// 16 MiB. Here a message may be 16 MiB and goes back as fragments of
// `WS_FRAGMENT` bytes, the next sent as the output drains. It runs in a
// readiness loop of its own, which `InteropServer` steps when that loop's
// descriptor is ready, as it does `H1Loop`'s.
import { netLocalPort, pollAdd, pollCreate, pollModify, pollWait, tcpListen } from "nish:net";
import { WS_CLOSE_INTERNAL_ERROR, WS_OP_CONTINUATION } from "nish/net/websocket";
import {
  H1_AGAIN,
  H1_DONE,
  H1_ERROR,
  H1_INVALID,
  H1_NEED_MORE,
  H1_POOL_FULL,
  H1_REQUEST,
  H1_WANT_READ,
  H1_WANT_WRITE,
  H1_WRITE,
  H1_WS_MESSAGE,
  Http1Config,
  Http1Connection,
  Http1Server,
} from "nish/net/http1-server";

/** The listener's token in this port's loop; slot `k`'s is `k`. */
const WS_LISTENER: i32 = 1000;
/** Connections served at once: the fuzzingclient opens one per case, one after another. */
export const WS_SLOTS: i32 = 8;
/** The longest message taken: Autobahn's largest, cases 9.1.6 and 9.2.6. */
export const WS_MAX_MESSAGE: i32 = 16777216;
/** The most payload one echoed frame carries: a quarter of the output, so one fits whenever `H1_WRITE` says half is free. */
export const WS_FRAGMENT: i32 = 16384;

/** One slot's echo: the message `conn.data` holds, and how much of it has gone back. */
class WsEcho {
  /** Whether a message is being echoed: `sent` bytes so far, then another frame. */
  busy: boolean = false;
  opcode: i32 = 0;
  sent: i32 = 0;
}

/** The configuration: a 16 MiB message, the default 64 KiB output, and every other limit `Http1Config`'s default. */
export const wsConfig = (): Http1Config => {
  const config = new Http1Config();
  config.maxMessage = WS_MAX_MESSAGE;
  return config;
};

/** The echo port on 127.0.0.1, its loop and its slots. */
export class InteropWs {
  loop: i32 = -1;
  listener: i32 = -1;
  port: i32 = 0;
  server: Http1Server;
  echoes: WsEcho[];
  ready: i32[];
  none: u8[][];
  /** Messages echoed whole, for the checks. */
  echoed: i32 = 0;

  /** Listening on `port`, or any free port for 0. */
  constructor(port: i32) {
    this.ready = new Array<i32>(toI32(2) * (WS_SLOTS + toI32(1)));
    this.none = [];
    this.loop = pollCreate();
    this.listener = tcpListen("127.0.0.1", port, toI32(16));
    this.port = netLocalPort(this.listener);
    this.server = new Http1Server(wsConfig(), this.listener, WS_SLOTS);
    this.echoes = [];
    for (let k: i32 = toI32(0); k < WS_SLOTS; k++) {
      this.echoes.push(new WsEcho());
    }
    pollAdd(this.loop, this.listener, toI32(1), WS_LISTENER);
  }

  /** Everything ready in this port's loop, without waiting; closes slots idle past the configuration's timeouts. */
  step(): void {
    const n: i32 = pollWait(this.loop, this.ready, toI32(0));
    for (let i: i32 = toI32(0); i < n; i++) {
      const who: i32 = this.ready[toI32(2) * i];
      if (who === WS_LISTENER) {
        this.acceptAll();
      } else {
        this.serve(who, this.ready[toI32(2) * i + toI32(1)]);
      }
    }
    this.server.expire(monotonicNanos());
  }

  /** Accepts every waiting connection; one past the pool is refused. */
  acceptAll(): void {
    while (true) {
      const slot: i32 = this.server.accept();
      if (slot >= 0) {
        this.echoes[slot].busy = false;
        pollAdd(this.loop, this.server.fd(slot), H1_WANT_READ, slot);
      } else if (slot !== H1_POOL_FULL) {
        return;
      }
    }
  }

  /** A slot's descriptor is ready: drive it, answer its events, then re-arm or close it. */
  serve(slot: i32, events: i32): void {
    if (!this.server.holds(slot)) {
      return;
    }
    let wants: i32 = (events & toI32(5)) !== toI32(0) ? this.server.readable(slot) : this.server.writable(slot);
    const conn: Http1Connection = this.server.connection(slot);
    const echo: WsEcho = this.echoes[slot];
    let event: i32 = this.server.next(slot);
    while (event !== H1_NEED_MORE && event !== H1_ERROR) {
      if (event === H1_REQUEST) {
        if (conn.acceptWebSocket("") !== 0) {
          conn.respond(toI32(400), this.none, this.none, toI32(0));
          conn.end();
        }
      } else if (event === H1_WS_MESSAGE) {
        echo.busy = true;
        echo.opcode = conn.opcode;
        echo.sent = toI32(0);
        this.pump(conn, echo);
      } else if (event === H1_WRITE && echo.busy) {
        this.pump(conn, echo);
      }
      event = this.server.next(slot);
    }
    wants = this.server.flush(slot);
    if ((wants & H1_DONE) !== toI32(0)) {
      this.server.close(slot);
      return;
    }
    if (this.server.rearm(slot, wants)) {
      pollModify(this.loop, this.server.fd(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), slot);
    }
  }

  /**
   * Sends the message's next frames until it is all sent or the output is
   * full; a full output holds the decoder, so `conn.data` is the same message
   * when `H1_WRITE` asks for the rest. The first frame carries the message's
   * opcode, the rest are continuations, and an empty message is one empty
   * frame. A frame refused outright drops the message: `H1_INVALID` closes
   * the connection with 1011 rather than leave the peer waiting for the rest,
   * and `H1_CLOSED` means it is already closing.
   */
  pump(conn: Http1Connection, echo: WsEcho): void {
    while (echo.busy) {
      const left: i32 = conn.dataLength - echo.sent;
      const n: i32 = left < WS_FRAGMENT ? left : WS_FRAGMENT;
      const opcode: i32 = echo.sent === toI32(0) ? echo.opcode : WS_OP_CONTINUATION;
      const r: i32 = conn.sendFrame(n === left, opcode, conn.data, conn.dataStart + echo.sent, n);
      if (r === H1_AGAIN) {
        return;
      }
      if (r !== toI32(0)) {
        echo.busy = false;
        if (r === H1_INVALID) {
          conn.closeWebSocket(WS_CLOSE_INTERNAL_ERROR);
        }
        return;
      }
      echo.sent = echo.sent + n;
      if (echo.sent === conn.dataLength) {
        echo.busy = false;
        this.echoed = this.echoed + toI32(1);
      }
    }
  }
}

// The server programs of the TCP carriers, as a relay would write them: each
// answers the events its carrier names and holds what the carrier could not
// take yet, in buffers made once per slot, so that nothing here allocates per
// request, per message or per byte. That is what lets a loopback check
// measure a whole server wake — carrier and program — and expect nothing.
import { HTTP1_CHUNKED } from "nish/net/http1";
import {
  H1_AGAIN,
  H1_BODY,
  H1_END,
  H1_ERROR,
  H1_REQUEST,
  H1_WRITE,
  H1_WS_CLOSE,
  H1_WS_MESSAGE,
  Http1Connection,
} from "nish/net/http1-server";
import { WS_OP_CONTINUATION } from "nish/net/websocket";
import { TLS_RECORD_DONE } from "nish/net/tls/record-server";
import { TlsTcpServer } from "nish/net/tls-tcp";
import { httpFieldBytes, httpFieldIs } from "nish/net/http-fields";
import { H2_DATA, H2_GOAWAY, H2_REQUEST, H2_RESET, H2_WINDOW, Http2Connection } from "nish/net/http2";
import { ZERO } from "../net_tls_record_common/bytes";

/** The largest WebSocket frame the echo sends: a message longer than this goes back in fragments. */
export const WS_FRAGMENT: i32 = 2048;

/**
 * TLS over TCP's program: everything a client sends comes back. Each slot
 * reads into a buffer of its own and keeps what the carrier did not take, so
 * the next wake writes that before it reads again; the client's
 * close_notify ends the connection.
 */
export class EchoSlots {
  bufs: u8[][];
  starts: i32[];
  lengths: i32[];
  /** How many connections ended on the client's close_notify. */
  peerCloses: i32 = 0;
  /** The bytes echoed, in all. */
  echoed: i64 = 0;

  constructor(slots: i32) {
    this.bufs = [];
    this.starts = new Array<i32>(slots);
    this.lengths = new Array<i32>(slots);
    for (let k: i32 = 0; k < slots; k++) {
      this.bufs.push(new Array<u8>(16384));
    }
  }

  reset(slot: i32): void {
    if (slot < toI32(this.bufs.length)) {
      this.starts[slot] = 0;
      this.lengths[slot] = 0;
    }
  }

  /** Writes what is held, then reads and writes until either side stops; answers the interest. */
  pump(tls: TlsTcpServer, slot: i32): i32 {
    const buf: u8[] = this.bufs[slot];
    while (true) {
      if (this.lengths[slot] > 0) {
        const w: i32 = tls.write(slot, buf, this.starts[slot], this.lengths[slot]);
        if (w < 0) {
          return tls.interest(slot);
        }
        this.starts[slot] = this.starts[slot] + w;
        this.lengths[slot] = this.lengths[slot] - w;
        this.echoed = this.echoed + toI64(w);
        if (this.lengths[slot] > 0) {
          return tls.interest(slot);
        }
      }
      const n: i32 = tls.read(slot, buf, ZERO, toI32(buf.length));
      if (n === 0) {
        this.peerCloses = this.peerCloses + 1;
        return TLS_RECORD_DONE;
      }
      if (n < 0) {
        return tls.interest(slot);
      }
      this.starts[slot] = 0;
      this.lengths[slot] = n;
    }
  }
}

// What a slot's request asked of `H1App`.
const H1_MODE_NONE: i32 = 0;
const H1_MODE_ECHO: i32 = 1;
const H1_MODE_WS: i32 = 2;

/**
 * HTTP/1.1's program. `GET /hello` answers a short body with its length;
 * `POST /echo` streams the request body back chunked as it arrives; `/ws`
 * accepts a WebSocket and echoes every message in fragments of at most
 * `WS_FRAGMENT` bytes, so a message larger than the connection's output goes
 * back whole. A write the connection holds back is resumed on `H1_WRITE`:
 * the connection reads nothing until then, so the window it was writing from
 * is still the one it names.
 */
export class H1App {
  names: u8[][];
  values: u8[][];
  none: u8[][];
  hello: u8[];
  mode: i32[];
  pendingStart: i32[];
  pendingLength: i32[];
  ended: boolean[];
  /** The message being echoed: its opcode, its length, and how much of it has gone. */
  wsOpcode: i32[];
  wsLength: i32[];
  wsAt: i32[];
  wsBusy: boolean[];
  requests: i32 = 0;
  messages: i32 = 0;
  fragments: i32 = 0;
  /** The last WebSocket close status a slot reported, and the last H1_ERROR's. */
  closeStatus: i32 = 0;
  errorStatus: i32 = 0;
  /** A write the connection refused outright: never expected. */
  refusals: i32 = 0;

  constructor(slots: i32) {
    this.names = [httpFieldBytes("Content-Type")];
    this.values = [httpFieldBytes("text/plain")];
    this.none = [];
    this.hello = httpFieldBytes("hello over loopback\n");
    this.mode = new Array<i32>(slots);
    this.pendingStart = new Array<i32>(slots);
    this.pendingLength = new Array<i32>(slots);
    this.ended = new Array<boolean>(slots);
    this.wsOpcode = new Array<i32>(slots);
    this.wsLength = new Array<i32>(slots);
    this.wsAt = new Array<i32>(slots);
    this.wsBusy = new Array<boolean>(slots);
  }

  reset(slot: i32): void {
    if (slot < toI32(this.mode.length)) {
      this.mode[slot] = H1_MODE_NONE;
      this.pendingLength[slot] = 0;
      this.ended[slot] = false;
      this.wsBusy[slot] = false;
    }
  }

  /** Answers `event` on slot `slot`'s connection. */
  handle(conn: Http1Connection, event: i32, slot: i32): void {
    if (event === H1_REQUEST) {
      this.request(conn, slot);
    } else if (event === H1_BODY) {
      if (this.mode[slot] === H1_MODE_ECHO) {
        this.echo(conn, slot, conn.dataStart, conn.dataLength);
      }
    } else if (event === H1_END) {
      this.ended[slot] = true;
      if (this.mode[slot] === H1_MODE_ECHO && this.pendingLength[slot] === 0) {
        conn.end();
      }
    } else if (event === H1_WRITE) {
      if (this.mode[slot] === H1_MODE_ECHO) {
        if (this.pendingLength[slot] > 0) {
          this.echo(conn, slot, this.pendingStart[slot], this.pendingLength[slot]);
        }
        if (this.pendingLength[slot] === 0 && this.ended[slot]) {
          conn.end();
        }
      } else if (this.wsBusy[slot]) {
        this.fragment(conn, slot);
      }
    } else if (event === H1_WS_MESSAGE) {
      this.messages = this.messages + 1;
      this.wsOpcode[slot] = conn.opcode;
      this.wsLength[slot] = conn.dataLength;
      this.wsAt[slot] = 0;
      this.wsBusy[slot] = true;
      this.fragment(conn, slot);
    } else if (event === H1_WS_CLOSE) {
      this.closeStatus = conn.status;
    } else if (event === H1_ERROR) {
      this.errorStatus = conn.status;
    }
  }

  /** A request's head: routes it. */
  request(conn: Http1Connection, slot: i32): void {
    this.requests = this.requests + 1;
    this.mode[slot] = H1_MODE_NONE;
    this.pendingLength[slot] = 0;
    this.ended[slot] = false;
    const p = conn.parser;
    if (p.targetIs("/ws")) {
      if (conn.acceptWebSocket("") === 0) {
        this.mode[slot] = H1_MODE_WS;
      } else {
        this.refusals = this.refusals + 1;
      }
    } else if (p.targetIs("/hello")) {
      conn.respond(toI32(200), this.names, this.values, toI32(this.hello.length));
      conn.write(this.hello, ZERO, toI32(this.hello.length));
      conn.end();
    } else if (p.targetIs("/echo")) {
      conn.respond(toI32(200), this.names, this.values, HTTP1_CHUNKED);
      this.mode[slot] = H1_MODE_ECHO;
    } else {
      conn.respond(toI32(404), this.none, this.none, ZERO);
      conn.end();
    }
  }

  /** Writes `conn.data[start .. start + length)` back, keeping what did not fit for `H1_WRITE`. */
  echo(conn: Http1Connection, slot: i32, start: i32, length: i32): void {
    const n: i32 = conn.write(conn.data, start, length);
    const taken: i32 = n > 0 ? n : 0;
    this.pendingStart[slot] = start + taken;
    this.pendingLength[slot] = length - taken;
  }

  /** Sends the message being echoed on, a fragment at a time, until the output is full or it has all gone. */
  fragment(conn: Http1Connection, slot: i32): void {
    while (this.wsBusy[slot]) {
      const at: i32 = this.wsAt[slot];
      const left: i32 = this.wsLength[slot] - at;
      const n: i32 = left < WS_FRAGMENT ? left : WS_FRAGMENT;
      const opcode: i32 = at === 0 ? this.wsOpcode[slot] : WS_OP_CONTINUATION;
      const r: i32 = conn.sendFrame(n === left, opcode, conn.data, conn.dataStart + at, n);
      if (r === H1_AGAIN) {
        return;
      }
      if (r < 0) {
        this.refusals = this.refusals + 1;
        this.wsBusy[slot] = false;
        return;
      }
      this.fragments = this.fragments + 1;
      this.wsAt[slot] = at + n;
      this.wsBusy[slot] = n < left;
    }
  }
}

/** How many streams of one connection `H2App` echoes at once. */
const H2_STREAMS: i32 = 4;
/** What one echoing stream can hold back while the client's window is shut: more than the server's own receive window, so it never fills. */
const H2_HELD: i32 = 131072;

/**
 * HTTP/2's program. A GET is answered with a short body; any other request
 * has its body echoed back on its own stream, DATA frame by DATA frame, and
 * ends when the request has. What the client's flow-control window does not
 * let out yet is held per stream, in a buffer made once, and goes when
 * `H2_WINDOW` says the window has opened (or on any later wake). The
 * server's receive window (65,535 bytes a stream) bounds what a client can
 * send past what was echoed, so the buffer is larger than any backlog.
 */
export class H2App {
  names: u8[][];
  values: u8[][];
  body: u8[];
  empty: u8[];
  /** Per slot and stream entry (`slot * H2_STREAMS + k`): its stream id (0 when free), what it holds, and whether the request ended. */
  ids: i32[];
  held: u8[][];
  heldStart: i32[];
  heldLength: i32[];
  ended: boolean[];
  finished: boolean[];
  requests: i32 = 0;
  goaways: i32 = 0;
  resets: i32 = 0;
  /** Requests that found no free entry, and bytes that found no room: never expected. */
  overflows: i32 = 0;

  constructor(slots: i32) {
    this.names = [httpFieldBytes("content-type")];
    this.values = [httpFieldBytes("text/plain")];
    this.body = httpFieldBytes("hello over loopback\n");
    this.empty = [];
    const entries: i32 = slots * H2_STREAMS;
    this.ids = new Array<i32>(entries);
    this.held = [];
    this.heldStart = new Array<i32>(entries);
    this.heldLength = new Array<i32>(entries);
    this.ended = new Array<boolean>(entries);
    this.finished = new Array<boolean>(entries);
    for (let k: i32 = 0; k < entries; k++) {
      this.held.push(new Array<u8>(H2_HELD));
    }
  }

  reset(slot: i32): void {
    for (let k: i32 = 0; k < H2_STREAMS && slot * H2_STREAMS + k < toI32(this.ids.length); k++) {
      this.ids[slot * H2_STREAMS + k] = 0;
    }
  }

  /** The entry of stream `id` on `slot`, or -1. */
  entry(slot: i32, id: i32): i32 {
    for (let k: i32 = 0; k < H2_STREAMS; k++) {
      if (this.ids[slot * H2_STREAMS + k] === id) {
        return slot * H2_STREAMS + k;
      }
    }
    return -1;
  }

  /** Answers `event` on slot `slot`'s connection. */
  handle(conn: Http2Connection, event: i32, slot: i32): void {
    if (event === H2_REQUEST) {
      this.requests = this.requests + 1;
      conn.respond(conn.stream, toI32(200), this.names, this.values, false);
      if (httpFieldIs(conn.fields.method, "GET")) {
        conn.writeData(conn.stream, this.body, ZERO, toI32(this.body.length), true);
        return;
      }
      const e: i32 = this.entry(slot, ZERO);
      if (e < 0) {
        this.overflows = this.overflows + 1;
        return;
      }
      this.ids[e] = conn.stream;
      this.heldStart[e] = 0;
      this.heldLength[e] = 0;
      this.ended[e] = conn.endStream;
      this.finished[e] = false;
      this.flush(conn, e);
    } else if (event === H2_DATA) {
      const e: i32 = this.entry(slot, conn.stream);
      if (e < 0) {
        return;
      }
      let at: i32 = conn.dataStart;
      let left: i32 = conn.dataLength;
      if (this.heldLength[e] === 0 && left > 0) {
        const n: i32 = conn.writeData(conn.stream, conn.data, at, left, false);
        const taken: i32 = n > 0 ? n : 0;
        at = at + taken;
        left = left - taken;
      }
      this.hold(e, conn.data, at, left);
      this.ended[e] = conn.endStream;
      this.flush(conn, e);
    } else if (event === H2_WINDOW) {
      this.resume(conn, slot);
    } else if (event === H2_GOAWAY) {
      this.goaways = this.goaways + 1;
    } else if (event === H2_RESET) {
      this.resets = this.resets + 1;
      const e: i32 = this.entry(slot, conn.stream);
      if (e >= 0) {
        this.ids[e] = 0;
      }
    }
  }

  /** Keeps `buf[at .. at + n)` behind what entry `e` already holds, moving that to the front first when it must. */
  hold(e: i32, buf: u8[], at: i32, n: i32): void {
    if (n <= 0) {
      return;
    }
    const held: u8[] = this.held[e];
    if (this.heldStart[e] + this.heldLength[e] + n > H2_HELD) {
      for (let k: i32 = 0; k < this.heldLength[e]; k++) {
        held[k] = held[this.heldStart[e] + k];
      }
      this.heldStart[e] = 0;
    }
    if (this.heldLength[e] + n > H2_HELD) {
      this.overflows = this.overflows + 1;
      return;
    }
    const end: i32 = this.heldStart[e] + this.heldLength[e];
    for (let k: i32 = 0; k < n; k++) {
      held[end + k] = buf[at + k];
    }
    this.heldLength[e] = this.heldLength[e] + n;
  }

  /** Writes what entry `e` holds as far as the windows let it, then the END_STREAM once the request has ended. */
  flush(conn: Http2Connection, e: i32): void {
    const id: i32 = this.ids[e];
    while (this.heldLength[e] > 0) {
      const n: i32 = conn.writeData(id, this.held[e], this.heldStart[e], this.heldLength[e], false);
      if (n <= 0) {
        return;
      }
      this.heldStart[e] = this.heldStart[e] + n;
      this.heldLength[e] = this.heldLength[e] - n;
    }
    if (this.ended[e] && !this.finished[e]) {
      this.finished[e] = conn.writeData(id, this.empty, ZERO, ZERO, true) >= 0;
      if (this.finished[e]) {
        this.ids[e] = 0;
      }
    }
  }

  /** Every stream of `slot` that holds something tries again. */
  resume(conn: Http2Connection, slot: i32): void {
    for (let k: i32 = 0; k < H2_STREAMS; k++) {
      const e: i32 = slot * H2_STREAMS + k;
      if (this.ids[e] !== 0) {
        this.flush(conn, e);
      }
    }
  }
}

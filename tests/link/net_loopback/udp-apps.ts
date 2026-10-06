// The server programs of the UDP carriers, as a relay would write them, over
// one table of echoing streams made once: a stream's bytes come back on the
// stream they arrived on (or, for a WebTransport unidirectional stream, on
// one the server opens), and what the carrier cannot take yet waits in the
// stream's entry until it says the stream is writable again. Nothing here
// allocates per stream, per request or per byte, so a whole server round —
// carrier and program — is what a loopback check measures.
import { QUIC_STREAM_END, QuicConnection } from "nish/net/quic";
import {
  H3_DATA,
  H3_END,
  H3_GOAWAY,
  H3_REQUEST,
  H3_RESET,
  H3_WRITABLE,
  Http3Connection,
} from "nish/net/http3";
import {
  WT_CLOSED,
  WT_DATAGRAM,
  WT_SESSION,
  WT_STREAM,
  WT_STREAM_DATA,
  WT_STREAM_END,
  WT_STREAM_RESET,
  WT_WRITABLE,
  WebTransport,
} from "nish/net/webtransport";
import { httpFieldBytes, httpFieldIs } from "nish/net/http-fields";
import { ZERO } from "../net_tls_record_common/bytes";

/** What one stream entry holds back: more than a stream's 32 KiB of credit, so it never fills. */
const HELD: i32 = 131072;

/** The streams being echoed at once, across every slot. */
const ENTRIES: i32 = 16;

/** One echoing stream per entry: its id (-1 when free), where its echo goes, what is held, and how far it has ended. */
export class EchoTable {
  held: u8[][];
  ids: i64[];
  outs: i64[];
  slots: i32[];
  starts: i32[];
  lengths: i32[];
  ended: boolean[];
  empty: u8[];
  /** Streams that found no free entry, and bytes that found no room: never expected. */
  overflows: i32 = 0;

  constructor() {
    this.held = [];
    this.ids = new Array<i64>(ENTRIES);
    this.outs = new Array<i64>(ENTRIES);
    this.slots = new Array<i32>(ENTRIES);
    this.starts = new Array<i32>(ENTRIES);
    this.lengths = new Array<i32>(ENTRIES);
    this.ended = new Array<boolean>(ENTRIES);
    this.empty = [];
    for (let k: i32 = 0; k < ENTRIES; k++) {
      this.held.push(new Array<u8>(HELD));
      this.ids[k] = toI64(-1);
    }
  }

  /** The entry of stream `id` on `slot`, or -1. */
  find(slot: i32, id: i64): i32 {
    for (let k: i32 = 0; k < ENTRIES; k++) {
      if (this.ids[k] === id && this.slots[k] === slot) {
        return k;
      }
    }
    return -1;
  }

  /** A free entry for stream `id` on `slot`, echoing on `out`; -1, counted, when none is free. */
  claim(slot: i32, id: i64, out: i64): i32 {
    const free: i32 = this.findFree();
    if (free < 0) {
      this.overflows = this.overflows + 1;
      return -1;
    }
    this.ids[free] = id;
    this.outs[free] = out;
    this.slots[free] = slot;
    this.starts[free] = 0;
    this.lengths[free] = 0;
    this.ended[free] = false;
    return free;
  }

  /** Any free entry, or -1. */
  findFree(): i32 {
    for (let k: i32 = 0; k < ENTRIES; k++) {
      if (this.ids[k] < 0) {
        return k;
      }
    }
    return -1;
  }

  /** Frees entry `e`. */
  release(e: i32): void {
    if (e >= 0) {
      this.ids[e] = toI64(-1);
    }
  }

  /** Frees every entry of `slot`, whose connection is gone. */
  forget(slot: i32): void {
    for (let k: i32 = 0; k < ENTRIES; k++) {
      if (this.slots[k] === slot) {
        this.ids[k] = toI64(-1);
      }
    }
  }

  /** Keeps `buf[at .. at + n)` behind what entry `e` holds, moving that to the front first when it must. */
  hold(e: i32, buf: u8[], at: i32, n: i32): void {
    if (n <= 0 || e < 0) {
      return;
    }
    const held: u8[] = this.held[e];
    if (this.starts[e] + this.lengths[e] + n > HELD) {
      for (let k: i32 = 0; k < this.lengths[e]; k++) {
        held[k] = held[this.starts[e] + k];
      }
      this.starts[e] = 0;
    }
    if (this.lengths[e] + n > HELD) {
      this.overflows = this.overflows + 1;
      return;
    }
    const end: i32 = this.starts[e] + this.lengths[e];
    for (let k: i32 = 0; k < n; k++) {
      held[end + k] = buf[at + k];
    }
    this.lengths[e] = this.lengths[e] + n;
  }

  /** Marks `n` of entry `e`'s held bytes as gone. */
  took(e: i32, n: i32): void {
    this.starts[e] = this.starts[e] + n;
    this.lengths[e] = this.lengths[e] - n;
  }
}

/**
 * QUIC's program: every stream the client opens is echoed back on itself,
 * read only while nothing is held so that QUIC's own flow control is the
 * back-pressure, and every DATAGRAM is sent back.
 */
export class QuicApp {
  table: EchoTable;
  datagram: u8[];
  echoed: i64 = 0;
  datagrams: i32 = 0;
  /** Datagrams that could not be queued: never expected. */
  dropped: i32 = 0;

  constructor() {
    this.table = new EchoTable();
    this.datagram = new Array<u8>(1500);
  }

  /** Every stream with news, and every datagram that came, answered. */
  serve(conn: QuicConnection): void {
    let id: i64 = conn.nextStreamEvent();
    while (id >= 0) {
      this.stream(conn, id);
      id = conn.nextStreamEvent();
    }
    let n: i32 = conn.readDatagram(this.datagram, ZERO, toI32(this.datagram.length));
    while (n >= 0) {
      this.datagrams = this.datagrams + 1;
      if (conn.sendDatagram(this.datagram, ZERO, n) !== 0) {
        this.dropped = this.dropped + 1;
      }
      n = conn.readDatagram(this.datagram, ZERO, toI32(this.datagram.length));
    }
  }

  /** Stream `id`: what is held goes first; then it is read and written until either side stops. */
  stream(conn: QuicConnection, id: i64): void {
    const t: EchoTable = this.table;
    let e: i32 = t.find(ZERO, id);
    if (e < 0) {
      e = t.claim(ZERO, id, id);
      if (e < 0) {
        return;
      }
    }
    for (let guard: i32 = 0; guard < 100000; guard++) {
      while (t.lengths[e] > 0) {
        const w: i32 = conn.streamWrite(id, t.held[e], t.starts[e], t.lengths[e], false);
        if (w <= 0) {
          return;
        }
        t.took(e, w);
        this.echoed = this.echoed + toI64(w);
      }
      if (t.ended[e]) {
        if (conn.streamWrite(id, t.empty, ZERO, ZERO, true) >= 0) {
          t.release(e);
        }
        return;
      }
      const n: i32 = conn.streamRead(id, t.held[e], ZERO, toI32(t.held[e].length));
      if (n === QUIC_STREAM_END) {
        t.ended[e] = true;
      } else if (n <= 0) {
        if (n < 0) {
          t.release(e);
        }
        return;
      } else {
        t.starts[e] = 0;
        t.lengths[e] = n;
      }
    }
  }
}

/**
 * HTTP/3's program. `GET /hello` answers a short body; `POST /echo` streams
 * its body back as it arrives and ends when the request has. A connection's
 * GOAWAY is counted.
 */
export class H3App {
  table: EchoTable;
  names: u8[][];
  values: u8[][];
  none: u8[][];
  hello: u8[];
  requests: i32 = 0;
  goaways: i32 = 0;
  resets: i32 = 0;

  constructor() {
    this.table = new EchoTable();
    this.names = [httpFieldBytes("content-type")];
    this.values = [httpFieldBytes("text/plain")];
    this.none = [];
    this.hello = httpFieldBytes("hello over loopback\n");
  }

  /** Answers `event` on slot `slot`'s connection `h3`. */
  handle(h3: Http3Connection, event: i32, slot: i32): void {
    const t: EchoTable = this.table;
    const id: i64 = h3.stream;
    if (event === H3_REQUEST) {
      this.requests = this.requests + 1;
      if (httpFieldIs(h3.fields.path, "/hello")) {
        h3.respond(id, toI32(200), this.names, this.values, false);
        h3.writeData(id, this.hello, ZERO, toI32(this.hello.length), true);
      } else if (httpFieldIs(h3.fields.path, "/echo")) {
        h3.respond(id, toI32(200), this.names, this.values, false);
        t.claim(slot, id, id);
      } else {
        h3.respond(id, toI32(404), this.none, this.none, true);
      }
    } else if (event === H3_DATA) {
      const e: i32 = t.find(slot, id);
      if (e < 0) {
        return;
      }
      let taken: i32 = 0;
      if (t.lengths[e] === 0) {
        const n: i32 = h3.writeData(id, h3.data, h3.dataStart, h3.dataLength, false);
        taken = n > 0 ? n : 0;
      }
      t.hold(e, h3.data, h3.dataStart + taken, h3.dataLength - taken);
    } else if (event === H3_END) {
      const e: i32 = t.find(slot, id);
      if (e >= 0) {
        t.ended[e] = true;
        this.flush(h3, e);
      }
    } else if (event === H3_WRITABLE) {
      const e: i32 = t.find(slot, id);
      if (e >= 0) {
        this.flush(h3, e);
      }
    } else if (event === H3_GOAWAY) {
      this.goaways = this.goaways + 1;
    } else if (event === H3_RESET) {
      this.resets = this.resets + 1;
      t.release(t.find(slot, id));
    }
  }

  /** Writes what entry `e` holds, and the FIN once its request ended and nothing is held. */
  flush(h3: Http3Connection, e: i32): void {
    const t: EchoTable = this.table;
    const id: i64 = t.ids[e];
    while (t.lengths[e] > 0) {
      const n: i32 = h3.writeData(id, t.held[e], t.starts[e], t.lengths[e], false);
      if (n <= 0) {
        return;
      }
      t.took(e, n);
    }
    if (t.ended[e] && h3.writeData(id, t.empty, ZERO, ZERO, true) >= 0) {
      t.release(e);
    }
  }
}

/**
 * WebTransport's program, one `WebTransport` per slot: it accepts every
 * session, echoes every datagram, echoes a bidirectional stream on itself
 * and a unidirectional one on a stream it opens, and notes how each session
 * closed.
 */
export class WtApp {
  table: EchoTable;
  datagrams: i32 = 0;
  sessions: i32 = 0;
  /** The last session close: its code, its reason, and whether the client sent it. */
  closeCode: i64 = -1;
  closeReason: string = "";
  closedByPeer: boolean = false;
  /** Writes the layer refused: never expected. */
  refusals: i32 = 0;

  constructor() {
    this.table = new EchoTable();
  }

  /** Answers every event `wt`, the layer of slot `slot`, has. */
  serve(wt: WebTransport, slot: i32, event: i32): void {
    const t: EchoTable = this.table;
    if (event === WT_SESSION) {
      this.sessions = this.sessions + 1;
      if (wt.accept(wt.sessionId) !== 0) {
        this.refusals = this.refusals + 1;
      }
    } else if (event === WT_DATAGRAM) {
      this.datagrams = this.datagrams + 1;
      if (wt.sendDatagram(wt.sessionId, wt.data, wt.dataStart, wt.dataLength) !== 0) {
        this.refusals = this.refusals + 1;
      }
    } else if (event === WT_STREAM) {
      const out: i64 = wt.bidirectional ? wt.stream : wt.openStream(wt.sessionId, false);
      if (out < 0) {
        this.refusals = this.refusals + 1;
      }
      t.claim(slot, wt.stream, out);
    } else if (event === WT_STREAM_DATA) {
      const e: i32 = t.find(slot, wt.stream);
      if (e < 0) {
        return;
      }
      let taken: i32 = 0;
      if (t.lengths[e] === 0) {
        const n: i32 = wt.write(t.outs[e], wt.data, wt.dataStart, wt.dataLength, false);
        taken = n > 0 ? n : 0;
      }
      t.hold(e, wt.data, wt.dataStart + taken, wt.dataLength - taken);
    } else if (event === WT_STREAM_END) {
      const e: i32 = t.find(slot, wt.stream);
      if (e >= 0) {
        t.ended[e] = true;
        this.flush(wt, e);
      }
    } else if (event === WT_WRITABLE) {
      for (let e: i32 = 0; e < ENTRIES; e++) {
        if (t.ids[e] >= 0 && t.slots[e] === slot && (t.outs[e] === wt.stream || t.ids[e] === wt.stream)) {
          this.flush(wt, e);
        }
      }
    } else if (event === WT_STREAM_RESET) {
      t.release(t.find(slot, wt.stream));
    } else if (event === WT_CLOSED) {
      const reason: string[] = [];
      for (let k: i32 = 0; k < wt.dataLength; k++) {
        reason.push(String.fromCharCode(toI32(wt.data[wt.dataStart + k])));
      }
      this.closeCode = wt.errorCode;
      this.closeReason = reason.join("");
      this.closedByPeer = wt.closedByPeer;
    }
  }

  /** Writes what entry `e` holds on its echo stream, and the FIN once its stream ended and nothing is held. */
  flush(wt: WebTransport, e: i32): void {
    const t: EchoTable = this.table;
    const out: i64 = t.outs[e];
    while (t.lengths[e] > 0) {
      const n: i32 = wt.write(out, t.held[e], t.starts[e], t.lengths[e], false);
      if (n <= 0) {
        return;
      }
      t.took(e, n);
    }
    if (t.ended[e] && wt.write(out, t.empty, ZERO, ZERO, true) >= 0) {
      t.release(e);
    }
  }
}

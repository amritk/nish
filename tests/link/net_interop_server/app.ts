// The interop server's QUIC application, one slot of an `Http3Server` at a
// time, chosen by the ALPN the handshake chose:
//
// - `hq-interop` (the quic-interop-runner's HTTP/0.9): a request is
//   `GET /<file>` on a client bidirectional stream, and the answer is the
//   file's bytes from the `www` directory and the FIN — nothing, for a file
//   that is not there. The slot's QUIC connection is driven directly; its
//   `Http3Connection` is never asked for an event, so it never closes a
//   connection that did not choose `h3`.
// - `h3`, through the slot's `WebTransport`: a GET answers the file from `www`
//   (404 when it is not there), or `hello from nish interop` when no `www` was
//   given; any other request answers how many body bytes it carried. A
//   WebTransport session is accepted, its datagrams echoed, and each of its
//   streams echoed once the client ends it — a bidirectional one on itself, a
//   unidirectional one on a stream of the server's.
//
// Each stream's state is a fixed entry, found from the QUIC connection's own
// stream slot, so nothing is searched per event.
import { QUIC_STREAM_END } from "nish/net/quic-stream";
import { QuicConnection } from "nish/net/quic";
import { httpFieldBytes, httpFieldIs } from "nish/net/http-fields";
import { H3_AGAIN, H3_DATA, H3_END, H3_ERROR, H3_NEED_MORE, H3_REQUEST, H3_WRITABLE, Http3Connection } from "nish/net/http3";
import { Http3Server } from "nish/net/http3-server";
import {
  WT_DATAGRAM,
  WT_SESSION,
  WT_STREAM,
  WT_STREAM_DATA,
  WT_STREAM_END,
  WT_WRITABLE,
  WebTransport,
} from "nish/net/webtransport";
import { textOf } from "../crypto_x509/hex";
import { InteropFiles } from "./files";

/** The ALPN of the quic-interop-runner's HTTP/0.9. */
export const HQ_ALPN: string = "hq-interop";

/** The longest HTTP/0.9 request line read, and the most a WebTransport stream echo holds. */
const REQUEST_MAX: i32 = 1024;
const ECHO_MAX: i32 = 65536;

/** What a stream entry is doing. */
const MODE_FREE: i32 = 0;
const MODE_HQ_READ: i32 = 1;
const MODE_H3: i32 = 2;
const MODE_WT_READ: i32 = 3;
const MODE_WRITE: i32 = 4;

/** One stream's state: what it asked for, and what is being written back. */
class InteropStream {
  id: i64 = -1;
  /** The request's `:path`, for HTTP/3. */
  path: u8[];
  received: i64 = 0;
  /** The request line, or the echo, as it arrives. */
  input: u8[];
  out: u8[];
  mode: i32 = 0;
  inputLength: i32 = 0;
  at: i32 = 0;
  /** Whether `out` goes as the request's DATA frames (HTTP/3) or on a WebTransport stream. */
  h3: boolean = false;
  get: boolean = false;

  constructor() {
    this.input = new Array<u8>(REQUEST_MAX);
    this.out = [];
    this.path = [];
  }

  /** Takes the entry for stream `id` in `mode`. */
  start(id: i64, mode: i32): void {
    this.id = id;
    this.mode = mode;
    this.h3 = false;
    this.path = [];
    this.get = false;
    this.received = 0;
    this.inputLength = 0;
    this.at = 0;
    this.out = [];
  }
}

/**
 * What tells one connection in a slot from the next: the Source Connection ID
 * the server chose for it at random, as a 64-bit number. (The client's
 * original DCID would not do: a client may choose the same one twice.)
 */
export const connectionMark = (quic: QuicConnection): i64 => {
  let mark: i64 = 0;
  for (let k: i32 = 0; k < 8 && k < toI32(quic.localScid.length); k++) {
    mark = (mark << toI64(8)) | toI64(quic.localScid[k]);
  }
  return mark;
};

/** The application over every slot of `server`. */
export class InteropApp {
  server: Http3Server;
  wts: WebTransport[];
  files: InteropFiles;
  /** Each slot's stream entries, `perSlot` of them, by the QUIC stream slot. */
  streams: InteropStream[];
  /** Each slot's connection, as `connectionMark` read it when its entries were last cleared. */
  marks: i64[];
  names: u8[][];
  textValues: u8[][];
  fileValues: u8[][];
  perSlot: i32 = 0;
  /** Requests answered, by kind, for a log or a test. */
  hqAnswered: i32 = 0;
  h3Answered: i32 = 0;
  datagramsEchoed: i32 = 0;
  streamsEchoed: i32 = 0;
  sessions: i32 = 0;

  constructor(server: Http3Server, wts: WebTransport[], files: InteropFiles) {
    this.server = server;
    this.wts = wts;
    this.files = files;
    this.perSlot = toI32(server.quic(toI32(0)).streams.slots.length);
    this.streams = [];
    for (let k: i32 = 0; k < this.perSlot * server.size(); k++) {
      this.streams.push(new InteropStream());
    }
    this.marks = new Array<i64>(server.size());
    this.names = [httpFieldBytes("content-type"), httpFieldBytes("server")];
    this.textValues = [httpFieldBytes("text/plain"), httpFieldBytes("nish")];
    this.fileValues = [httpFieldBytes(files.type), httpFieldBytes("nish")];
  }

  /** The entry of stream `id` in `slot`, or `null` for a stream the connection does not hold. */
  entry(slot: i32, id: i64): InteropStream | null {
    const k: i32 = this.server.quic(slot).streams.slotOf(id);
    if (k < 0 || k >= this.perSlot) {
      return null;
    }
    return this.streams[slot * this.perSlot + k];
  }

  /**
   * Every event of `slot`'s connection, answered. A slot holds one
   * connection after another, whose stream IDs start again from 0, so its
   * entries are cleared when the connection in it is a new one.
   */
  serve(slot: i32): void {
    const quic: QuicConnection = this.server.quic(slot);
    const mark: i64 = connectionMark(quic);
    if (mark !== this.marks[slot]) {
      this.marks[slot] = mark;
      for (let k: i32 = slot * this.perSlot; k < (slot + 1) * this.perSlot; k++) {
        this.streams[k].start(toI64(-1), MODE_FREE);
      }
    }
    if (quic.alpn === HQ_ALPN) {
      this.serveHq(slot, quic);
    } else {
      this.serveH3(slot, this.wts[slot]);
    }
  }

  // ---- HTTP/0.9 -----------------------------------------------------------------

  /** The streams of an `hq-interop` connection with something new. */
  serveHq(slot: i32, quic: QuicConnection): void {
    let id: i64 = quic.nextStreamEvent();
    while (id >= 0) {
      const s: InteropStream | null = this.entry(slot, id);
      // A client bidirectional stream is a request; nothing else is.
      if (s !== null && (id & toI64(3)) === toI64(0)) {
        if (s.id !== id) {
          s.start(id, MODE_HQ_READ);
        }
        if (s.mode === MODE_HQ_READ) {
          this.readRequest(quic, s);
        }
        if (s.mode === MODE_WRITE) {
          this.pushHq(quic, s);
        }
      }
      id = quic.nextStreamEvent();
    }
  }

  /** Reads `s`'s request line as far as it has come, and starts the answer once it is whole. */
  readRequest(quic: QuicConnection, s: InteropStream): void {
    let ended: boolean = false;
    while (s.inputLength < REQUEST_MAX) {
      const n: i32 = quic.streamRead(s.id, s.input, s.inputLength, REQUEST_MAX - s.inputLength);
      if (n === QUIC_STREAM_END) {
        ended = true;
        break;
      }
      if (n < 0) {
        s.mode = MODE_FREE;
        return;
      }
      if (n === 0) {
        break;
      }
      s.inputLength = s.inputLength + n;
    }
    let end: i32 = -1;
    for (let k: i32 = 0; k < s.inputLength && end < 0; k++) {
      if (s.input[k] === toU8(13) || s.input[k] === toU8(10)) {
        end = k;
      }
    }
    if (end < 0 && !ended && s.inputLength < REQUEST_MAX) {
      return;
    }
    const line: u8[] = [];
    const stop: i32 = end >= 0 ? end : s.inputLength;
    for (let k: i32 = 0; k < stop; k++) {
      line.push(s.input[k]);
    }
    const text: string = textOf(line);
    // `GET /<file>`, perhaps with a version after it, which HTTP/0.9 never had.
    const rest: string = text.startsWith("GET ") ? text.slice(toI32(4)) : "";
    const space: i32 = toI32(rest.indexOf(" "));
    const path: string = space < 0 ? rest : rest.slice(toI32(0), space);
    const body: u8[] | null = this.files.get(httpFieldBytes(path));
    s.out = body === null ? [] : body;
    s.mode = MODE_WRITE;
    this.hqAnswered = this.hqAnswered + 1;
  }

  /** Writes what `s` still owes on an `hq-interop` stream, and the FIN after. */
  pushHq(quic: QuicConnection, s: InteropStream): void {
    const length: i32 = toI32(s.out.length);
    while (s.mode === MODE_WRITE) {
      const n: i32 = quic.streamWrite(s.id, s.out, s.at, length - s.at, true);
      if (n < 0) {
        s.mode = MODE_FREE;
        return;
      }
      s.at = s.at + n;
      if (s.at >= length) {
        s.mode = MODE_FREE;
      } else if (n === 0) {
        return;
      }
    }
  }

  // ---- HTTP/3 and WebTransport --------------------------------------------------

  /** Every event of an `h3` connection, through its WebTransport layer. */
  serveH3(slot: i32, wt: WebTransport): void {
    const h3: Http3Connection = this.server.connection(slot);
    let event: i32 = wt.next();
    while (event !== H3_NEED_MORE && event !== H3_ERROR) {
      if (event === H3_REQUEST) {
        const s: InteropStream | null = this.entry(slot, h3.stream);
        if (s !== null) {
          s.start(h3.stream, MODE_H3);
          s.h3 = true;
          // The fields are the connection's, and are written over by its next request.
          for (const b of h3.fields.path) {
            s.path.push(b);
          }
          s.get = httpFieldIs(h3.fields.method, "GET");
        }
      } else if (event === H3_DATA) {
        const s: InteropStream | null = this.entry(slot, h3.stream);
        if (s !== null && s.id === h3.stream) {
          s.received = s.received + toI64(h3.dataLength);
        }
      } else if (event === H3_END) {
        const s: InteropStream | null = this.entry(slot, h3.stream);
        if (s !== null && s.id === h3.stream && s.mode === MODE_H3) {
          this.answerH3(h3, wt, s);
        }
      } else if (event === H3_WRITABLE || event === WT_WRITABLE) {
        const id: i64 = event === H3_WRITABLE ? h3.stream : wt.stream;
        const s: InteropStream | null = this.entry(slot, id);
        if (s !== null && s.id === id && s.mode === MODE_WRITE) {
          this.pushH3(h3, wt, s);
        }
      } else if (event === WT_SESSION) {
        wt.accept(wt.sessionId);
        this.sessions = this.sessions + 1;
      } else if (event === WT_DATAGRAM) {
        if (wt.sendDatagram(wt.sessionId, wt.data, wt.dataStart, wt.dataLength) >= 0) {
          this.datagramsEchoed = this.datagramsEchoed + 1;
        }
      } else if (event === WT_STREAM) {
        const s: InteropStream | null = this.entry(slot, wt.stream);
        if (s !== null) {
          s.start(wt.stream, MODE_WT_READ);
        }
      } else if (event === WT_STREAM_DATA) {
        const s: InteropStream | null = this.entry(slot, wt.stream);
        if (s !== null && s.id === wt.stream && s.mode === MODE_WT_READ) {
          this.takeEcho(wt, s);
        }
      } else if (event === WT_STREAM_END) {
        const s: InteropStream | null = this.entry(slot, wt.stream);
        if (s !== null && s.id === wt.stream && s.mode === MODE_WT_READ) {
          this.echoBack(slot, h3, wt, s);
        }
      }
      event = wt.next();
    }
  }

  /** A request has ended: its head, and the body it is owed. */
  answerH3(h3: Http3Connection, wt: WebTransport, s: InteropStream): void {
    let status: i32 = 200;
    let values: u8[][] = this.textValues;
    if (!s.get) {
      s.out = httpFieldBytes(`received ${s.received} bytes\n`);
    } else {
      const body: u8[] | null = this.files.get(s.path);
      if (body === null) {
        status = 404;
        s.out = httpFieldBytes("not found\n");
      } else {
        values = this.fileValues;
        s.out = body;
      }
    }
    if (h3.respond(s.id, status, this.names, values, false) < 0) {
      s.mode = MODE_FREE;
      return;
    }
    s.mode = MODE_WRITE;
    this.h3Answered = this.h3Answered + 1;
    this.pushH3(h3, wt, s);
  }

  /** A WebTransport stream's bytes, kept for the echo; past `ECHO_MAX` the stream is refused. */
  takeEcho(wt: WebTransport, s: InteropStream): void {
    if (toI32(s.out.length) + wt.dataLength > ECHO_MAX) {
      wt.resetStream(s.id, toI64(0));
      s.mode = MODE_FREE;
      return;
    }
    for (let k: i32 = 0; k < wt.dataLength; k++) {
      s.out.push(wt.data[wt.dataStart + k]);
    }
  }

  /** The client ended a WebTransport stream: its bytes go back, on itself or on a new stream of the server's. */
  echoBack(slot: i32, h3: Http3Connection, wt: WebTransport, s: InteropStream): void {
    if ((s.id & toI64(2)) === toI64(0)) {
      s.mode = MODE_WRITE;
      this.pushH3(h3, wt, s);
      return;
    }
    const out: i64 = wt.openStream(wt.sessionId, false);
    const t: InteropStream | null = out < 0 ? null : this.entry(slot, out);
    if (t === null) {
      s.mode = MODE_FREE;
      return;
    }
    const bytes: u8[] = s.out;
    s.mode = MODE_FREE;
    t.start(out, MODE_WRITE);
    t.out = bytes;
    this.pushH3(h3, wt, t);
  }

  /** Writes what `s` still owes, as a response body or a WebTransport stream, and its end after. */
  pushH3(h3: Http3Connection, wt: WebTransport, s: InteropStream): void {
    const length: i32 = toI32(s.out.length);
    while (s.mode === MODE_WRITE) {
      const n: i32 = s.h3
        ? h3.writeData(s.id, s.out, s.at, length - s.at, true)
        : wt.write(s.id, s.out, s.at, length - s.at, true);
      if (n < 0) {
        // The stream is full, and names itself writable again.
        if (n !== H3_AGAIN) {
          s.mode = MODE_FREE;
        }
        return;
      }
      s.at = s.at + n;
      if (s.at >= length) {
        s.mode = MODE_FREE;
        if (!s.h3) {
          this.streamsEchoed = this.streamsEchoed + 1;
        }
      } else if (n === 0) {
        return;
      }
    }
  }
}

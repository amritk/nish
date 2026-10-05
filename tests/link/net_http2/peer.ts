// A scripted HTTP/2 client for the `nish/net/http2` tests: it builds the
// client's frames with `nish/net/http2-frame`'s writers and its header blocks
// with its own HPACK encoder, feeds them to a server `Http2Connection` as a
// socket would, and renders what comes back — the events the program sees and
// the frames the server sends — as text a check can compare.
import { HPACK_INDEX_WITHOUT, HpackDecoder, HpackEncoder } from "nish/net/hpack";
import {
  H2_FLAG_ACK,
  H2_FLAG_END_HEADERS,
  H2_FLAG_END_STREAM,
  H2_FRAME_CONTINUATION,
  H2_FRAME_DATA,
  H2_FRAME_GOAWAY,
  H2_FRAME_HEADERS,
  H2_FRAME_PING,
  H2_FRAME_RST_STREAM,
  H2_FRAME_SETTINGS,
  H2_FRAME_WINDOW_UPDATE,
  Http2Frame,
  http2ParseFrame,
  http2ReadHeader,
  http2SettingCount,
  http2SettingId,
  http2SettingValue,
  http2WriteContinuation,
  http2WriteData,
  http2WriteGoaway,
  http2WriteHeaders,
  http2WritePing,
  http2WritePriority,
  http2WriteRstStream,
  http2WriteSettings,
  http2WriteSettingsAck,
  http2WriteWindowUpdate,
} from "nish/net/http2-frame";
import {
  H2_DATA,
  H2_ERROR,
  H2_GOAWAY,
  H2_NEED_MORE,
  H2_REQUEST,
  H2_RESET,
  H2_TRAILERS,
  H2_WINDOW,
  Http2Config,
  Http2Connection,
} from "nish/net/http2";

/** A typed zero for offsets: a bare literal is an `f64` under `--number-mode f64`. */
export const ZERO: i32 = 0;

/** No padding, typed. */
export const NO_PAD: i32 = -1;

/** The client connection preface (RFC 9113 §3.4). */
export const PREFACE: string = "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n";

const H2_HEX_DIGITS: string = "0123456789abcdef";

/** The bytes of an ASCII string. */
export const h2Bytes = (text: string): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    out.push(toU8(text.charCodeAt(k)));
  }
  return out;
};

/** `bytes` as lowercase hex, two digits a byte. */
export const h2Hex = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    const v: i32 = toI32(b);
    parts.push(H2_HEX_DIGITS.substring(v >> 4, (v >> 4) + 1));
    parts.push(H2_HEX_DIGITS.substring(v & 15, (v & 15) + 1));
  }
  return parts.join("");
};

/** The value of one lowercase hex digit. */
const h2Nibble = (c: i32): i32 => (c >= 97 ? c - 87 : c - 48);

/** The bytes a lowercase hex string spells, two digits a byte. */
export const h2FromHex = (hex: string): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k + 1 < toI32(hex.length); k += 2) {
    out.push(toU8(h2Nibble(toI32(hex.charCodeAt(k))) * 16 + h2Nibble(toI32(hex.charCodeAt(k + 1)))));
  }
  return out;
};

/** `bytes[from .. from + n)` as text, one character a byte. */
export const textAt = (bytes: u8[], from: i32, n: i32): string => {
  const parts: string[] = [];
  for (let k: i32 = 0; k < n && from + k < toI32(bytes.length); k++) {
    parts.push(String.fromCharCode(toI32(bytes[from + k])));
  }
  return parts.join("");
};

/** `n` bytes of `x`. */
export const filler = (n: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < n; k++) {
    out.push(toU8(120));
  }
  return out;
};

/** The names of the alternating `name, value` list `pairs`, as bytes. */
export const namesOf = (pairs: string[]): u8[][] => {
  const out: u8[][] = [];
  for (let k: i32 = 0; k + 1 < toI32(pairs.length); k += 2) {
    out.push(h2Bytes(pairs[k]));
  }
  return out;
};

/** The values of the alternating `name, value` list `pairs`, as bytes. */
export const valuesOf = (pairs: string[]): u8[][] => {
  const out: u8[][] = [];
  for (let k: i32 = 0; k + 1 < toI32(pairs.length); k += 2) {
    out.push(h2Bytes(pairs[k + 1]));
  }
  return out;
};

/** A GET of `path`, as the alternating list a header block is built from. */
export const getOf = (path: string): string[] => [":method", "GET", ":scheme", "https", ":path", path, ":authority", "example.com"];

/** A POST of `path` with `content-length: length`. */
export const postOf = (path: string, length: i32): string[] => [":method", "POST", ":scheme", "https", ":path", path, ":authority", "example.com", "content-length", `${length}`];

/** The client's bytes, frame by frame, for one `send`. */
export class Wire {
  out: u8[];
  scratch: u8[];
  enc: HpackEncoder;

  constructor() {
    this.out = [];
    this.scratch = new Array<u8>(70000);
    this.enc = new HpackEncoder(4096);
  }

  /** Appends `scratch[0 .. end)`, what a writer just wrote. */
  add(end: i32): void {
    for (let k: i32 = 0; k < end && k < toI32(this.scratch.length); k++) {
      this.out.push(this.scratch[k]);
    }
  }

  /** Appends raw bytes. */
  raw(bytes: u8[]): void {
    for (const b of bytes) {
      this.out.push(b);
    }
  }

  /** Appends the bytes `hex` spells. */
  hex(text: string): void {
    this.raw(h2FromHex(text));
  }

  preface(): void {
    this.raw(h2Bytes(PREFACE));
  }

  settings(ids: i32[], values: i64[]): void {
    this.add(http2WriteSettings(this.scratch, ZERO, ids, values));
  }

  settingsAck(): void {
    this.add(http2WriteSettingsAck(this.scratch, ZERO));
  }

  /** The header block for the alternating `name, value` list `pairs`, encoded without indexing. */
  block(pairs: string[]): u8[] {
    const out: u8[] = [];
    for (let k: i32 = 0; k + 1 < toI32(pairs.length); k += 2) {
      this.enc.encodeField(out, h2Bytes(pairs[k]), h2Bytes(pairs[k + 1]), HPACK_INDEX_WITHOUT, false);
    }
    return out;
  }

  /** HEADERS carrying `pairs` whole, with END_HEADERS and `flags`. */
  headers(stream: i32, pairs: string[], flags: i32): void {
    const b: u8[] = this.block(pairs);
    this.add(http2WriteHeaders(this.scratch, ZERO, stream, b, ZERO, toI32(b.length), flags | H2_FLAG_END_HEADERS, NO_PAD));
  }

  /** HEADERS carrying `block[off, off + len)`, with exactly `flags`. */
  headersPart(stream: i32, block: u8[], off: i32, len: i32, flags: i32): void {
    this.add(http2WriteHeaders(this.scratch, ZERO, stream, block, off, len, flags, NO_PAD));
  }

  continuation(stream: i32, block: u8[], off: i32, len: i32, flags: i32): void {
    this.add(http2WriteContinuation(this.scratch, ZERO, stream, block, off, len, flags));
  }

  /** HEADERS carrying `pairs` whole, with END_HEADERS, END_STREAM and the PRIORITY fields: `stream` on `dependency`. */
  headersWithPriority(stream: i32, pairs: string[], dependency: i32): void {
    const fields: u8[] = this.block(pairs);
    const payload: u8[] = [toU8((dependency >> 24) & 127), toU8((dependency >> 16) & 255), toU8((dependency >> 8) & 255), toU8(dependency & 255), toU8(15)];
    for (const b of fields) {
      payload.push(b);
    }
    const n: i32 = toI32(payload.length);
    this.raw([toU8(0), toU8(n >> 8), toU8(n & 255), toU8(1), toU8(0x25), toU8(0), toU8(0), toU8(0), toU8(stream)]);
    this.raw(payload);
  }

  data(stream: i32, text: string, flags: i32): void {
    const bytes: u8[] = h2Bytes(text);
    this.add(http2WriteData(this.scratch, ZERO, stream, bytes, ZERO, toI32(bytes.length), flags, NO_PAD));
  }

  /** DATA of `n` filler bytes. */
  dataN(stream: i32, n: i32, flags: i32): void {
    this.add(http2WriteData(this.scratch, ZERO, stream, filler(n), ZERO, n, flags, NO_PAD));
  }

  windowUpdate(stream: i32, increment: i32): void {
    this.add(http2WriteWindowUpdate(this.scratch, ZERO, stream, increment));
  }

  ping(hex: string): void {
    this.add(http2WritePing(this.scratch, ZERO, h2FromHex(hex), ZERO, false));
  }

  rst(stream: i32, code: i32): void {
    this.add(http2WriteRstStream(this.scratch, ZERO, stream, toI64(code)));
  }

  goaway(last: i32, code: i32): void {
    const none: u8[] = [];
    this.add(http2WriteGoaway(this.scratch, ZERO, last, toI64(code), none, ZERO, ZERO));
  }

  priority(stream: i32, dependency: i32): void {
    this.add(http2WritePriority(this.scratch, ZERO, stream, dependency, false, 16));
  }

  /** Every byte built so far, taken out. */
  take(): u8[] {
    const out: u8[] = this.out;
    this.out = [];
    return out;
  }
}

/**
 * The frames a server sent, rendered as text a check compares: bytes go in as
 * they arrive, cut anywhere, and each whole frame comes out as a line. A
 * header block is decoded once it ends, by a decoder of the client's own.
 */
export class FrameLog {
  dec: HpackDecoder;
  frame: Http2Frame;
  /** Bytes not yet whole frames. */
  pending: u8[];
  /** A header block the server has not ended yet, and how many frames it took. */
  block: u8[];
  blockFrames: i32 = 0;
  blockFlags: i32 = 0;
  frames: string[];

  constructor() {
    this.dec = new HpackDecoder(4096, 1000000);
    this.frame = new Http2Frame();
    this.pending = [];
    this.block = [];
    this.frames = [];
  }

  /** Takes `bytes[off, off + len)` and renders every frame that is now whole. */
  push(bytes: u8[], off: i32, len: i32): void {
    for (let k: i32 = off; k < off + len && k < toI32(bytes.length); k++) {
      this.pending.push(bytes[k]);
    }
    let at: i32 = 0;
    const n: i32 = toI32(this.pending.length);
    const f: Http2Frame = this.frame;
    while (http2ReadHeader(f, this.pending, at, n - at) && n - at >= 9 + f.length) {
      http2ParseFrame(f, this.pending, at, toI32(16777215));
      this.frames.push(this.renderFrame(f));
      at = at + 9 + f.length;
    }
    const rest: u8[] = [];
    for (let k: i32 = at; k < n && k < toI32(this.pending.length); k++) {
      rest.push(this.pending[k]);
    }
    this.pending = rest;
  }

  /** One frame the server sent, as text; a header block is rendered once it ends, with its fields. */
  renderFrame(f: Http2Frame): string {
    const p: u8[] = this.pending;
    switch (f.type) {
      case H2_FRAME_SETTINGS: {
        if (f.has(H2_FLAG_ACK)) {
          return "SETTINGS ack";
        }
        const parts: string[] = [];
        for (let k: i32 = 0; k < http2SettingCount(f); k++) {
          parts.push(`${http2SettingId(f, p, k)}=${http2SettingValue(f, p, k)}`);
        }
        return `SETTINGS ${parts.join(",")}`;
      }
      case H2_FRAME_DATA: {
        const end: string = f.has(H2_FLAG_END_STREAM) ? " end" : "";
        const text: string = f.contentLength <= 40 ? ` "${textAt(p, f.contentStart, f.contentLength)}"` : "";
        return `DATA ${f.streamId} ${f.contentLength}${text}${end}`;
      }
      case H2_FRAME_HEADERS:
      case H2_FRAME_CONTINUATION: {
        if (f.type === H2_FRAME_HEADERS) {
          this.block = [];
          this.blockFrames = 0;
          this.blockFlags = f.flags;
        }
        for (let k: i32 = 0; k < f.contentLength && f.contentStart + k < toI32(p.length); k++) {
          this.block.push(p[f.contentStart + k]);
        }
        this.blockFrames = this.blockFrames + 1;
        if (!f.has(H2_FLAG_END_HEADERS)) {
          return `(fragment ${f.streamId})`;
        }
        const status: i32 = this.dec.decode(this.block, ZERO, toI32(this.block.length));
        const fields: string[] = [];
        for (let k: i32 = 0; k < toI32(this.dec.names.length) && k < toI32(this.dec.values.length); k++) {
          const value: u8[] = this.dec.values[k];
          const shown: string = toI32(value.length) > 40 ? `(${value.length} bytes)` : textAt(value, ZERO, toI32(value.length));
          const never: string = k < toI32(this.dec.neverIndexed.length) && this.dec.neverIndexed[k] ? " (never indexed)" : "";
          fields.push(`${textAt(this.dec.names[k], ZERO, toI32(this.dec.names[k].length))}=${shown}${never}`);
        }
        const end: string = (this.blockFlags & H2_FLAG_END_STREAM) !== 0 ? " end" : "";
        const more: string = this.blockFrames > 1 ? ` +${this.blockFrames - 1}` : "";
        const bad: string = status < 0 ? ` hpack ${status}` : "";
        return `HEADERS ${f.streamId}${end}${more}${bad} ${fields.join(" ")}`;
      }
      case H2_FRAME_WINDOW_UPDATE:
        return `WINDOW_UPDATE ${f.streamId} ${f.increment}`;
      case H2_FRAME_RST_STREAM:
        return `RST_STREAM ${f.streamId} ${f.errorCode}`;
      case H2_FRAME_PING: {
        const opaque: u8[] = [];
        for (let k: i32 = 0; k < 8 && f.contentStart + k < toI32(p.length); k++) {
          opaque.push(p[f.contentStart + k]);
        }
        return `PING${f.has(H2_FLAG_ACK) ? " ack" : ""} ${h2Hex(opaque)}`;
      }
      case H2_FRAME_GOAWAY:
        return `GOAWAY ${f.lastStreamId} ${f.errorCode}`;
      default:
        return `frame ${f.type}`;
    }
  }

  /** The frames since the last call, joined. */
  take(): string {
    const text: string = this.frames.join("; ");
    this.frames = [];
    return text;
  }
}

/** A server connection, the client in front of it, and what each said. */
export class Client {
  conn: Http2Connection;
  wire: Wire;
  /** What the server sent. */
  log: FrameLog;
  events: string[];
  /** Whether the client reads what the server sends after each step. */
  reading: boolean = true;
  /** Whether H2_ERROR has been logged. */
  failed: boolean = false;

  constructor(config: Http2Config) {
    this.conn = new Http2Connection(config);
    this.wire = new Wire();
    this.log = new FrameLog();
    this.events = [];
  }

  /** The event the connection just answered, as text. */
  render(event: i32): string {
    const c: Http2Connection = this.conn;
    const end: string = c.endStream ? " end" : "";
    switch (event) {
      case H2_REQUEST: {
        const protocol: string = toI32(c.fields.protocol.length) > 0 ? ` ${textAt(c.fields.protocol, ZERO, toI32(c.fields.protocol.length))}` : "";
        const target: u8[] = toI32(c.fields.path.length) > 0 ? c.fields.path : c.fields.authority;
        return `request ${c.stream} ${textAt(c.fields.method, ZERO, toI32(c.fields.method.length))} ${textAt(target, ZERO, toI32(target.length))}${protocol}${end}`;
      }
      case H2_DATA:
        return `data ${c.stream} "${textAt(c.data, c.dataStart, c.dataLength < 40 ? c.dataLength : toI32(40))}"${c.dataLength >= 40 ? ` (${c.dataLength})` : ""}${end}`;
      case H2_TRAILERS:
        return `trailers ${c.stream} ${c.fields.names.length}`;
      case H2_RESET:
        return `reset ${c.stream} ${c.errorCode} ${c.resetByPeer ? "peer" : "rule"}`;
      case H2_WINDOW:
        return `window ${c.stream}`;
      case H2_GOAWAY:
        return `goaway ${c.lastStreamId} ${c.errorCode}`;
      default:
        return `error ${c.errorCode}`;
    }
  }

  /** Runs `next` until it needs more, logging each event; the final H2_ERROR is logged the first time only. */
  run(): void {
    let event: i32 = this.conn.next();
    while (event !== H2_NEED_MORE) {
      if (event === H2_ERROR) {
        if (!this.failed) {
          this.events.push(this.render(event));
        }
        this.failed = true;
        return;
      }
      this.events.push(this.render(event));
      event = this.conn.next();
    }
  }

  /** Hands the server everything `wire` holds, running it as it goes, the way a socket would. */
  send(): void {
    const bytes: u8[] = this.wire.take();
    let at: i32 = 0;
    let stalled: i32 = 0;
    while (at < toI32(bytes.length) && stalled < 4) {
      const n: i32 = this.conn.feed(bytes, at, toI32(bytes.length) - at);
      at = at + n;
      this.run();
      if (this.reading) {
        this.drain();
      }
      stalled = n === 0 ? stalled + 1 : 0;
    }
    this.run();
    if (this.reading) {
      this.drain();
    }
  }

  /** The same, one byte at a time. */
  sendBytewise(): void {
    const bytes: u8[] = this.wire.take();
    for (let at: i32 = 0; at < toI32(bytes.length); at++) {
      this.conn.feed(bytes, at, toI32(1));
      this.run();
    }
    this.drain();
  }

  /** Takes everything the server has to send and renders each whole frame. */
  drain(): void {
    const c: Http2Connection = this.conn;
    this.log.push(c.output, c.outputStart, c.outputEnd - c.outputStart);
    c.consume(c.outputEnd - c.outputStart);
  }

  /** The events since the last call, joined. */
  takeEvents(): string {
    const text: string = this.events.join("; ");
    this.events = [];
    return text;
  }

  /** The frames the server sent since the last call, joined. */
  takeFrames(): string {
    this.drain();
    return this.log.take();
  }

  /** The preface, an empty SETTINGS and the acknowledgement of the server's: a connection ready for streams. */
  open(): void {
    const ids: i32[] = [];
    const values: i64[] = [];
    this.wire.preface();
    this.wire.settings(ids, values);
    this.wire.settingsAck();
    this.send();
    this.takeEvents();
    this.takeFrames();
  }
}

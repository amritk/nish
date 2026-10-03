// Byte helpers for the `nish/net/tls` record-layer tests: one record sealed or
// opened into a fresh array, windows of arrays, and what a `TlsRecordServer`
// has to send, taken out of it as the socket would take it.
import { TLS_MAX_RECORD, TlsRecordProtection } from "nish/net/tls/record";
import { TlsRecordServer } from "nish/net/tls/record-server";

/** A typed zero for offsets: a bare literal is an `f64` under `--number-mode f64`. */
export const ZERO: i32 = 0;

/** `bytes[from .. to)`, in a fresh array; out-of-range ends are clamped. */
export const range = (bytes: u8[], from: i32, to: i32): u8[] => {
  const out: u8[] = [];
  const end: i32 = to < toI32(bytes.length) ? to : toI32(bytes.length);
  for (let k: i32 = from < 0 ? 0 : from; k < end && k < toI32(bytes.length); k++) {
    out.push(bytes[k]);
  }
  return out;
};

/** Every array of `parts`, one after another, in a fresh array. */
export const join = (parts: u8[][]): u8[] => {
  const out: u8[] = [];
  for (const part of parts) {
    for (const b of part) {
      out.push(b);
    }
  }
  return out;
};

/** The bytes of an ASCII string. */
export const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    out.push(toU8(text.charCodeAt(k)));
  }
  return out;
};

/** A KeyUpdate message (RFC 8446 §4.6.3) asking `request`: 0 or 1, or anything else for a refusal. */
export const keyUpdateMessage = (request: i32): u8[] => [toU8(24), toU8(0), toU8(0), toU8(1), toU8(request)];

/** `n` bytes, each `value`. */
export const filled = (n: i32, value: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < n; k++) {
    out.push(toU8(value));
  }
  return out;
};

/** The record `p` seals for `type` and `data` with `padding`, or an empty array when it refuses. */
export const sealOne = (p: TlsRecordProtection, type: i32, data: u8[], padding: i32): u8[] => {
  const out: u8[] = new Array<u8>(TLS_MAX_RECORD);
  const n: i32 = p.seal(type, data, ZERO, toI32(data.length), padding, out, ZERO);
  return n < 0 ? [] : range(out, ZERO, n);
};

/** What `open` made of one record: the content and its type, or the alert. */
export class Opened {
  alert: i32 = 0;
  type: i32 = 0;
  content: u8[];

  constructor() {
    this.content = [];
  }
}

/** `p` opening the whole record `record`. */
export const openOne = (p: TlsRecordProtection, record: u8[]): Opened => {
  const out: u8[] = new Array<u8>(TLS_MAX_RECORD);
  const n: i32 = p.open(record, ZERO, toI32(record.length), out, ZERO);
  const opened = new Opened();
  if (n < 0) {
    opened.alert = -n;
    return opened;
  }
  opened.type = p.contentType;
  opened.content = range(out, ZERO, n);
  return opened;
};

/** A protection installed for `suite` under `secret`. */
export const protectionFor = (suite: i32, secret: u8[]): TlsRecordProtection => {
  const p = new TlsRecordProtection();
  p.install(suite, secret);
  return p;
};

/** Everything `conn` has to send, taken out of it as a socket that took it all would. */
export const drain = (conn: TlsRecordServer): u8[] => {
  const out: u8[] = range(conn.output, conn.outputStart, conn.outputEnd);
  conn.consume(toI32(out.length));
  return out;
};

/** Hands `conn` every byte of `data`, as one call. */
export const feed = (conn: TlsRecordServer, data: u8[]): i32 => conn.receive(data, ZERO, toI32(data.length));

/** Every application byte `conn` holds, read out. */
export const readAll = (conn: TlsRecordServer): u8[] => {
  const buf: u8[] = new Array<u8>(1024);
  const out: u8[] = [];
  let n: i32 = conn.read(buf, ZERO, toI32(buf.length));
  while (n > 0) {
    for (let k: i32 = 0; k < n && k < toI32(buf.length); k++) {
      out.push(buf[k]);
    }
    n = conn.read(buf, ZERO, toI32(buf.length));
  }
  return out;
};

/** Whether every byte of `bytes` is zero (an empty array counts). */
export const allZero = (bytes: u8[]): boolean => {
  for (const b of bytes) {
    if (toI32(b) !== 0) {
      return false;
    }
  }
  return true;
};

/** A deterministic stream of numbers for the split tests: xorshift32 from a seed. */
export class Splitter {
  state: u32 = 0;

  constructor(seed: u32) {
    this.state = seed;
  }

  /** The next number in `[1, bound]`. */
  next(bound: i32): i32 {
    let x: u32 = this.state;
    x = x ^ (x << toU32(13));
    x = x ^ (x >> toU32(17));
    x = x ^ (x << toU32(5));
    this.state = x;
    return toI32(x % toU32(bound)) + 1;
  }
}

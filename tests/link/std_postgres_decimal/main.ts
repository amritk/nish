// nish/net/postgres's decimal writer, which `paramInt`, `paramIntArray` and
// `arrayInt` share, against the digit-at-a-time writer it replaced: every
// digit count, both signs, the i64 limits, and a number that ends exactly at
// the end of the output buffer.
import { PgConfig, PgConnection, PG_NEED_MORE } from "nish/net/postgres";
import { secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";

/** `text`'s bytes, each `|` a NUL. */
const z = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    const c: i32 = toI32(text.charCodeAt(i));
    out.push(toU8(c === 124 ? 0 : c));
  }
  return out;
};

const pushI32 = (out: u8[], v: i32): void => {
  out.push(toU8((v >> 24) & 255));
  out.push(toU8((v >> 16) & 255));
  out.push(toU8((v >> 8) & 255));
  out.push(toU8(v & 255));
};

/** A backend message: `type`, its length, `body`. */
const msg = (type: string, body: u8[]): u8[] => {
  const out: u8[] = [toU8(type.charCodeAt(0))];
  pushI32(out, toI32(body.length) + 4);
  for (const b of body) {
    out.push(b);
  }
  return out;
};

/** No parameter types. */
const none = (): i32[] => {
  const out: i32[] = [];
  return out;
};

/** A ready connection: trust auth, UTF8, a key and ReadyForQuery fed, the startup sent. */
const ready = (): PgConnection => {
  const c = new PgConfig();
  c.user = "app";
  c.database = "db";
  const password = secret(z("pw"));
  const conn = new PgConnection(c, password, z("nish-postgres-test"));
  wipe(password);
  conn.sent(conn.outputEnd() - conn.outputStart());
  const key: u8[] = [];
  pushI32(key, 4242);
  pushI32(key, 7);
  const auth: u8[] = [];
  pushI32(auth, 0);
  const bytes: u8[] = [];
  for (const part of [msg("R", auth), msg("S", z("client_encoding|UTF8|")), msg("K", key), msg("Z", z("I"))]) {
    for (const b of part) {
      bytes.push(b);
    }
  }
  let fed: i32 = 0;
  while (true) {
    fed += conn.receive(bytes, fed, toI32(bytes.length) - fed);
    if (conn.next() === PG_NEED_MORE && fed === toI32(bytes.length)) {
      break;
    }
  }
  return conn;
};

/** `value` in decimal as the writer before this one made it: a digit a step, then reversed. */
const reference = (value: i64): string => {
  const digits: string[] = [];
  let v: i64 = value < 0 ? value : -value;
  while (true) {
    digits.push(String.fromCharCode(48 - toI32(v % 10)));
    v = v / 10;
    if (v === 0) {
      break;
    }
  }
  const parts: string[] = value < 0 ? ["-"] : [];
  for (let i: i32 = toI32(digits.length) - 1; i >= 0 && i < toI32(digits.length); i--) {
    parts.push(digits[i]);
  }
  return parts.join("");
};

/** `out[start, end)` as text. */
const text = (out: u8[], start: i32, end: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = start; i >= 0 && i < end && i < toI32(out.length); i++) {
    parts.push(String.fromCharCode(toI32(out[i])));
  }
  return parts.join("");
};

/** The largest i64, 9223372036854775807. */
const i64Max = (): i64 => (toI64(922337203) * toI64(1000000000) + toI64(685477580)) * toI64(10) + toI64(7);

/** The most negative i64, -9223372036854775808. */
const i64Min = (): i64 => -i64Max() - 1;

/** 0, ±1, every power of ten and its neighbours on both signs, the i64 limits. */
const values = (): i64[] => {
  const out: i64[] = [toI64(0), toI64(1), toI64(-1)];
  let p: i64 = 1;
  for (let k: i32 = 1; k <= 18; k++) {
    p = p * 10;
    out.push(p - 1);
    out.push(p);
    out.push(p + 1);
    out.push(-(p - 1));
    out.push(-p);
    out.push(-(p + 1));
  }
  const max: i64 = i64Max();
  out.push(max);
  out.push(max - 1);
  out.push(-max);
  out.push(i64Min());
  out.push(toI64(1234567890) * toI64(1000000000) + toI64(123456789));
  out.push(toI64(-987654321) * toI64(1000000000) - toI64(98765432));
  out.push(toI64(42));
  out.push(toI64(-7));
  return out;
};

/** The big-endian i32 at `out[at, at + 4)`. */
const i32At = (out: u8[], at: i32): i32 => {
  let v: i32 = 0;
  for (let i: i32 = at; i >= 0 && i < at + 4 && i < toI32(out.length); i++) {
    v = (v << 8) | toI32(out[i]);
  }
  return v;
};

// A finished text Bind for "q" with one parameter: `B`, its length, the empty
// portal, `q`, no format codes, the parameter count, then the parameter's
// length word at 12 and its bytes at 16.
const PARAM_LENGTH: i32 = 12;
const PARAM_TEXT: i32 = 16;

/** The one parameter of the Bind that starts at `s`, as text. */
const parameter = (conn: PgConnection, s: i32): string => {
  const out: u8[] = conn.outputBuffer();
  const n: i32 = i32At(out, s + PARAM_LENGTH);
  return text(out, s + PARAM_TEXT, s + PARAM_TEXT + n);
};

/** A ready connection with "q" prepared and everything sent, so a Bind starts at `outputEnd()`. */
const prepared = (): PgConnection => {
  const conn = ready();
  conn.prepare("q", "select $1", none());
  conn.sent(conn.outputEnd() - conn.outputStart());
  return conn;
};

/** What `paramInt(value)` writes after its length word. */
const viaParamInt = (value: i64): string => {
  // Each on its own connection: nothing answers, so the pipeline would fill.
  const conn = prepared();
  const s: i32 = conn.outputEnd();
  conn.bindStart("q");
  conn.paramInt(value);
  conn.bindEnd();
  return parameter(conn, s);
};

const paramInts = (t: Suite): void => {
  const all: i64[] = values();
  let same: i32 = 0;
  const digitCounts: boolean[] = new Array<boolean>(20);
  for (const value of all) {
    const want: string = reference(value);
    const got: string = viaParamInt(value);
    if (got === want) {
      same += 1;
    } else {
      t.fail(`paramInt(${value})`, `wrote ${got}, want ${want}`);
    }
    const digits: i32 = toI32(want.length) - (value < 0 ? 1 : 0);
    if (digits >= 1 && digits < toI32(digitCounts.length)) {
      digitCounts[digits] = true;
    }
  }
  t.eqI32("paramInt writes what the digit-at-a-time writer wrote, for every value", same, toI32(all.length));
  let counts: i32 = 0;
  for (let d: i32 = 1; d < toI32(digitCounts.length); d++) {
    counts += digitCounts[d] ? 1 : 0;
  }
  t.eqI32("every digit count from 1 to 19 is among them", counts, 19);
  t.eqStr("the most negative i64", viaParamInt(i64Min()), "-9223372036854775808");
  t.eqStr("the largest i64", viaParamInt(i64Max()), "9223372036854775807");
  t.eqStr("zero", viaParamInt(toI64(0)), "0");
  t.eqStr("minus one", viaParamInt(toI64(-1)), "-1");
};

const paramIntArrays = (t: Suite): void => {
  const all: i64[] = values();
  const parts: string[] = [];
  for (const value of all) {
    parts.push(reference(value));
  }
  const conn = prepared();
  const s: i32 = conn.outputEnd();
  conn.bindStart("q");
  t.ok("paramIntArray", conn.paramIntArray(all, 0, toI32(all.length)));
  conn.bindEnd();
  t.eqStr("its text", parameter(conn, s), `{${parts.join(",")}}`);
  const other = prepared();
  const s2: i32 = other.outputEnd();
  other.bindStart("q");
  t.ok("an array parameter", other.arrayStart());
  for (const value of all) {
    other.arrayInt(value);
  }
  other.arrayEnd();
  other.bindEnd();
  t.eqStr("arrayInt writes the same text", parameter(other, s2), `{${parts.join(",")}}`);
};

/**
 * `value` by `paramInt` with its last digit `slack` bytes before the output
 * buffer's end; the `slack` bytes after it must be left as they were.
 */
const atTheEnd = (t: Suite, name: string, value: i64, slack: i32): void => {
  const conn = prepared();
  const s: i32 = conn.outputEnd();
  conn.bindStart("q");
  const size: i32 = toI32(conn.outputBuffer().length);
  const want: string = reference(value);
  // The text parameter's length word and bytes, then the integer's length word and digits.
  const pad: i32 = size - s - PARAM_LENGTH - 4 - 4 - toI32(want.length) - slack;
  const fill: string[] = [];
  for (let i: i32 = 0; i < pad; i++) {
    fill.push("x");
  }
  conn.paramText(fill.join(""));
  // The bytes past where the number will end, before it is written.
  const end: i32 = size - slack;
  const before: string = text(conn.outputBuffer(), end, size);
  conn.paramInt(value);
  t.eqI32(`${name}: the buffer did not grow`, toI32(conn.outputBuffer().length), size);
  if (slack > 0) {
    t.eqStr(`${name}: the ${slack} bytes after it are untouched`, text(conn.outputBuffer(), end, size), before);
  }
  conn.bindEnd();
  // The second parameter follows the first's length word and bytes.
  const at: i32 = s + PARAM_TEXT + pad;
  const out: u8[] = conn.outputBuffer();
  t.eqI32(`${name}: its length word`, i32At(out, at), toI32(want.length));
  t.eqI32(`${name}: it ends where it should`, at + 4 + toI32(want.length), size - slack);
  t.eqStr(`${name}: its text`, text(out, at + 4, size - slack), want);
  t.ok(`${name}: the bind still ends`, conn.sync());
};

export const main = (): number => {
  const t = new Suite("postgres decimal");
  paramInts(t);
  paramIntArrays(t);
  atTheEnd(t, "one digit", toI64(0), 0);
  atTheEnd(t, "nineteen digits", i64Max(), 0);
  atTheEnd(t, "the most negative i64", i64Min(), 0);
  atTheEnd(t, "one digit, three bytes short", toI64(7), 3);
  atTheEnd(t, "nineteen digits, three bytes short", i64Max(), 3);
  atTheEnd(t, "the most negative i64, three bytes short", i64Min(), 3);
  return t.done();
};

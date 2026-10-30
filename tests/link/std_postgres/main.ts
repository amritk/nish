// nish/net/postgres, function by function: what each builder writes, what
// each message does to the connection, and every way a server's answer, or a
// program's call, is refused. The exchanges with a real server are in
// std_postgres_replay; these are the frames no well-behaved server sends.
import {
  PgArrayWalker,
  PgBinary,
  PgBinaryArray,
  PgConfig,
  PgConnection,
  PgText,
  PG_ARRAY_BAD,
  PG_ARRAY_ELEMENT,
  PG_ARRAY_END,
  PG_ARRAY_NULL,
  PG_COMPLETE,
  PG_DESCRIBED,
  PG_ERROR,
  PG_ERR_AUTH_UNSUPPORTED,
  PG_ERR_CLOSED,
  PG_ERR_ENCODING,
  PG_ERR_FRAME,
  PG_ERR_NONE,
  PG_ERR_SCRAM,
  PG_ERR_SERVER,
  PG_ERR_SERVER_SIGNATURE,
  PG_ERR_SETTING,
  PG_ERR_TOO_BIG,
  PG_ERR_UNEXPECTED,
  PG_FAILED,
  PG_GROUP_DONE,
  PG_NEED_MORE,
  PG_NOTICE,
  PG_READY,
  PG_ROW,
} from "nish/net/postgres";
import { getI32BE, getU16BE, setF64BE, setI64BE } from "nish/bytes";
import { secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";

const NONCE: string = "nish-postgres-test";
// base64 of NONCE, the client's half of the SCRAM nonce.
const CLIENT_NONCE: string = "bmlzaC1wb3N0Z3Jlcy10ZXN0";

/** `text`'s bytes, each `|` a NUL. */
const z = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    const c: i32 = toI32(text.charCodeAt(i));
    out.push(toU8(c === 124 ? 0 : c));
  }
  return out;
};

/** No parameter types. */
const none = (): i32[] => {
  const out: i32[] = [];
  return out;
};

const slice = (b: u8[], start: i32, end: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = start; i < end && i < toI32(b.length); i++) {
    out.push(b[i]);
  }
  return out;
};

const nines = (n: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < n; i++) {
    parts.push("9");
  }
  return parts.join("");
};

const pushI32 = (out: u8[], v: i32): void => {
  out.push(toU8((v >> 24) & 255));
  out.push(toU8((v >> 16) & 255));
  out.push(toU8((v >> 8) & 255));
  out.push(toU8(v & 255));
};

const pushI16 = (out: u8[], v: i32): void => {
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

/** An authentication request: `code`, then `data`. */
const auth = (code: i32, data: u8[]): u8[] => {
  const body: u8[] = [];
  pushI32(body, code);
  for (const b of data) {
    body.push(b);
  }
  return msg("R", body);
};

const cat = (a: u8[], b: u8[]): u8[] => {
  const out: u8[] = [];
  for (const x of a) {
    out.push(x);
  }
  for (const x of b) {
    out.push(x);
  }
  return out;
};

/** A DataRow of `values`, each `null` written as a NULL column. */
const row = (values: string[], nulls: boolean[]): u8[] => {
  const body: u8[] = [];
  pushI16(body, toI32(values.length));
  for (let i: i32 = 0; i < toI32(values.length); i++) {
    if (i < toI32(nulls.length) && nulls[i]) {
      pushI32(body, -1);
    } else {
      pushI32(body, toI32(values[i].length));
      for (const b of z(values[i])) {
        body.push(b);
      }
    }
  }
  return msg("D", body);
};

/** Feeds `bytes`, then reads to the end: the events, `failed:<code>` for a failure. */
const feed = (conn: PgConnection, bytes: u8[]): string => {
  const events: string[] = [];
  let fed: i32 = 0;
  while (true) {
    fed += conn.receive(bytes, fed, toI32(bytes.length) - fed);
    const event: i32 = conn.next();
    if (event === PG_FAILED) {
      events.push(`failed:${conn.failure}`);
      break;
    }
    if (event === PG_NEED_MORE) {
      if (fed === toI32(bytes.length)) {
        break;
      }
    } else {
      events.push(`${event}`);
    }
  }
  return events.join(",");
};

/** The queued output as text, NULs as `|`, and marks it sent. */
const drain = (conn: PgConnection): string => {
  const out: u8[] = conn.outputBuffer();
  const parts: string[] = [];
  for (let i: i32 = conn.outputStart(); i < conn.outputEnd(); i++) {
    const c: i32 = toI32(out[i]);
    parts.push(c === 0 ? "|" : c < 32 || c > 126 ? `<${c}>` : String.fromCharCode(c));
  }
  conn.sent(conn.outputEnd() - conn.outputStart());
  return parts.join("");
};

const config = (): PgConfig => {
  const c = new PgConfig();
  c.user = "app";
  c.database = "db";
  return c;
};

const open = (c: PgConfig): PgConnection => {
  const password = secret(z("pw"));
  const nonce: u8[] = z(NONCE);
  const conn = new PgConnection(c, password, nonce);
  wipe(password);
  return conn;
};

const STARTUP_DONE = (): u8[] => {
  const key: u8[] = [];
  pushI32(key, 4242);
  pushI32(key, 7);
  return cat(cat(cat(auth(0, []), msg("S", z("client_encoding|UTF8|"))), msg("K", key)), msg("Z", z("I")));
};

/** A connection that is ready, its startup sent. */
const ready = (c: PgConfig): PgConnection => {
  const conn = open(c);
  drain(conn);
  feed(conn, STARTUP_DONE());
  return conn;
};

/** A ready connection with one group sent and unanswered. */
const inGroup = (): PgConnection => {
  const conn = ready(config());
  conn.prepare("", "select 1", none());
  conn.bindStart("");
  conn.bindEnd();
  conn.sync();
  drain(conn);
  return conn;
};

const startup = (t: Suite): void => {
  const conn = open(config());
  t.eqI32("starts needing input", conn.next(), PG_NEED_MORE);
  t.eqStr(
    "startup message: protocol 3.0, user, database, UTF8, ISO dates in UTC",
    drain(conn),
    "|||N|<3>||user|app|database|db|client_encoding|UTF8|DateStyle|ISO|TimeZone|UTC||",
  );
  const c = config();
  c.database = "";
  c.applicationName = "svc";
  c.options = "-c x=1";
  t.eqStr(
    "startup message: no database, an application name and options",
    drain(open(c)),
    "|||f|<3>||user|app|client_encoding|UTF8|DateStyle|ISO|TimeZone|UTC|application_name|svc|options|-c x=1||",
  );
  const conn2 = open(config());
  drain(conn2);
  t.eqStr("trust: AuthenticationOk, BackendKeyData, ReadyForQuery", feed(conn2, STARTUP_DONE()), `${PG_READY}`);
  t.eqI32("the backend's process id", conn2.backendPid, 4242);
  t.eqI32("idle", conn2.txStatus, 73);
  t.eqI32("no failure", conn2.failure, PG_ERR_NONE);
  t.ok("a ready connection may send", conn2.canSend());
  t.ok("a starting one may not", !open(config()).canSend());
};

const framing = (t: Suite): void => {
  const conn = open(config());
  const bad: u8[] = [toU8(82), toU8(0), toU8(0), toU8(0), toU8(3)];
  t.eqStr("a length under 4 is a framing failure", feed(conn, bad), `failed:${PG_ERR_FRAME}`);
  t.eqI32("a failed connection stays failed", conn.next(), PG_FAILED);

  const c = config();
  c.maxMessage = 1024;
  const big: u8[] = [toU8(83)];
  pushI32(big, 1025);
  t.eqStr("a message over maxMessage is refused before it is read", feed(open(c), big), `failed:${PG_ERR_TOO_BIG}`);

  const small = config();
  small.inputSize = 16;
  const tiny = open(small);
  t.eqI32("inputSize under 64 is raised to 64", tiny.inputRoom(), 64);
  const long: u8[] = cat(auth(0, []), msg("S", z(`server_version|${nines(300)}|`)));
  t.eqI32("receive copies only what fits", tiny.receive(long, 0, toI32(long.length)), 64);
  t.eqStr("a message larger than the buffer grows it", feed(tiny, slice(long, 64, toI32(long.length))), "");
  t.eqI32("and is read whole", tiny.serverVersion.length, 300);
  const doubling = open(small);
  const mid: u8[] = cat(auth(0, []), msg("S", z(`server_version|${nines(50)}|`)));
  doubling.receive(mid, 0, 64);
  t.eqI32("a message a little over the buffer", doubling.next(), PG_NEED_MORE);
  t.eqI32("doubles it", doubling.inputRoom(), 128 - 55);
  t.eqStr("and is read whole after it", feed(doubling, slice(mid, 64, toI32(mid.length))), "");

  const pieces = open(config());
  const whole: u8[] = STARTUP_DONE();
  let events: string = "";
  for (let i: i32 = 0; i < toI32(whole.length); i++) {
    events = `${events}${feed(pieces, slice(whole, i, i + 1))}`;
  }
  t.eqStr("a byte at a time", events, `${PG_READY}`);
};

const unexpected = (t: Suite): void => {
  t.eqStr("a row before authentication", feed(open(config()), row(["1"], [])), `failed:${PG_ERR_UNEXPECTED}`);
  t.eqStr("authentication once started", feed(ready(config()), auth(0, [])), `failed:${PG_ERR_UNEXPECTED}`);
  const key: u8[] = [];
  pushI32(key, 1);
  pushI32(key, 2);
  t.eqStr("BackendKeyData once ready", feed(ready(config()), msg("K", key)), `failed:${PG_ERR_UNEXPECTED}`);
  t.eqStr("ReadyForQuery with no group in flight", feed(ready(config()), msg("Z", z("I"))), `failed:${PG_ERR_UNEXPECTED}`);
  t.eqStr("a row with no group in flight", feed(ready(config()), row(["1"], [])), `failed:${PG_ERR_UNEXPECTED}`);
  t.eqStr("an ERROR with no group in flight", feed(ready(config()), msg("E", z("VERROR|C42601|Mbad||"))), `failed:${PG_ERR_UNEXPECTED}`);
  t.eqStr("an unknown message", feed(inGroup(), msg("W", [])), `failed:${PG_ERR_UNEXPECTED}`);
  t.eqStr("a CopyInResponse", feed(inGroup(), msg("G", [0, 0, 0])), `failed:${PG_ERR_UNEXPECTED}`);
  t.eqStr("a CopyOutResponse", feed(inGroup(), msg("H", [0, 0, 0])), `failed:${PG_ERR_UNEXPECTED}`);
  const open1 = ready(config());
  open1.prepare("", "select 1", none());
  drain(open1);
  t.eqStr("ReadyForQuery for a group not yet synced", feed(open1, msg("Z", z("I"))), `failed:${PG_ERR_UNEXPECTED}`);
  const note: u8[] = [];
  pushI32(note, 99);
  t.eqStr("a notification is ignored", feed(inGroup(), msg("A", cat(note, z("chan|x|")))), "");
};

const malformed = (t: Suite): void => {
  const frame: string = `failed:${PG_ERR_FRAME}`;
  t.eqStr("an error without its terminator", feed(open(config()), msg("E", z("SERROR|C42000|"))), frame);
  t.eqStr("a ParameterStatus without its value", feed(open(config()), msg("S", z("server_version|"))), frame);
  t.eqStr("an authentication request under 4 bytes", feed(open(config()), msg("R", z("ab"))), frame);
  t.eqStr("AuthenticationOk with data", feed(open(config()), auth(0, z("x"))), frame);
  const conn = open(config());
  feed(conn, auth(0, []));
  t.eqStr("BackendKeyData of 4 bytes", feed(conn, msg("K", z("abcd"))), frame);
  const conn2 = open(config());
  feed(conn2, auth(0, []));
  t.eqStr("ReadyForQuery with a status other than I, T, E", feed(conn2, msg("Z", z("X"))), frame);
  t.eqStr("ParseComplete with a body", feed(inGroup(), msg("1", z("x"))), frame);
  t.eqStr("a tag without its NUL", feed(inGroup(), msg("C", z("SELECT 1"))), frame);
  t.eqStr("EmptyQueryResponse with a body", feed(inGroup(), msg("I", z("x"))), frame);
  t.eqStr("NoData with a body", feed(inGroup(), msg("n", z("x"))), frame);
  const count: u8[] = [];
  pushI16(count, 2);
  pushI32(count, 23);
  t.eqStr("ParameterDescription short of its count", feed(inGroup(), msg("t", count)), frame);
  const longRow: u8[] = [];
  pushI16(longRow, 1);
  pushI32(longRow, 9);
  t.eqStr("a column longer than its row", feed(inGroup(), msg("D", cat(longRow, z("abc")))), frame);
  t.eqStr("a row with bytes after its columns", feed(inGroup(), msg("D", z("||x"))), frame);
  const minus: u8[] = [];
  pushI16(minus, 1);
  pushI32(minus, -2);
  t.eqStr("a column length of -2", feed(inGroup(), msg("D", minus)), frame);
  const top: u8[] = [];
  pushI16(top, 1);
  pushI32(top, -2147483647 - 1);
  // Past the row whether the length is read signed or unsigned; "a row with a
  // NULL" below pins the signed read, as -1 read unsigned is a frame error.
  t.eqStr("a column length of -2^31, past the row either way", feed(inGroup(), msg("D", cat(top, z("abc")))), frame);
  const high: u8[] = [];
  pushI16(high, 1);
  pushI32(high, 16777216 + 3);
  t.eqStr("a column length whose high byte is set", feed(inGroup(), msg("D", cat(high, z("abc")))), frame);
  const huge: u8[] = [toU8(83)];
  pushI32(huge, -2147483647 - 1);
  t.eqStr("a message length with its top bit set", feed(open(config()), huge), frame);
  const desc: u8[] = [];
  pushI16(desc, 1);
  t.eqStr("a RowDescription field cut short", feed(inGroup(), msg("T", cat(desc, z("id|abc")))), frame);

  const c = config();
  c.maxColumns = 2;
  const capped = ready(c);
  capped.prepare("", "select 1", none());
  drain(capped);
  t.eqStr("a row over maxColumns", feed(capped, row(["1", "2", "3"], [])), `failed:${PG_ERR_TOO_BIG}`);
};

/** A connection's answer to `serverFirst` after it offered SCRAM. */
const first = (serverFirst: string): string => {
  const c = open(config());
  feed(c, auth(10, z("SCRAM-SHA-256||")));
  return feed(c, auth(11, z(serverFirst)));
};

/** A connection that sent its proof for a well-formed server-first-message. */
const proved = (): PgConnection => {
  const c = open(config());
  feed(c, auth(10, z("SCRAM-SHA-256||")));
  drain(c);
  feed(c, auth(11, z(`r=${CLIENT_NONCE}xyz,s=c2FsdA==,i=4096`)));
  return c;
};

/** A connection's answer to `serverFinal` once it sent its proof. */
const final = (serverFinal: string): string => {
  const c = proved();
  drain(c);
  return feed(c, auth(12, z(serverFinal)));
};

const auths = (t: Suite): void => {
  t.eqStr("MD5 is refused", feed(open(config()), auth(5, z("salt"))), `failed:${PG_ERR_AUTH_UNSUPPORTED}`);
  t.eqStr("cleartext is refused", feed(open(config()), auth(3, [])), `failed:${PG_ERR_AUTH_UNSUPPORTED}`);
  t.eqStr("GSS is refused", feed(open(config()), auth(7, [])), `failed:${PG_ERR_AUTH_UNSUPPORTED}`);
  t.eqStr("SSPI is refused", feed(open(config()), auth(9, [])), `failed:${PG_ERR_AUTH_UNSUPPORTED}`);
  t.eqStr(
    "SASL without SCRAM-SHA-256",
    feed(open(config()), auth(10, z("SCRAM-SHA-256-PLUS||"))),
    `failed:${PG_ERR_AUTH_UNSUPPORTED}`,
  );
  t.eqStr("a SASL list without its end", feed(open(config()), auth(10, z("SCRAM-SHA-256|"))), `failed:${PG_ERR_FRAME}`);
  t.eqStr("SASLContinue before SASL", feed(open(config()), auth(11, z("r=x"))), `failed:${PG_ERR_UNEXPECTED}`);

  const conn = open(config());
  drain(conn);
  t.eqStr("SASL offering SCRAM-SHA-256", feed(conn, auth(10, z("SCRAM-SHA-256-PLUS|SCRAM-SHA-256||"))), "");
  t.eqStr(
    "SASLInitialResponse: the mechanism, then client-first-message",
    drain(conn),
    `p|||6SCRAM-SHA-256|||| n,,n=,r=${CLIENT_NONCE}`,
  );

  const scram: string = `failed:${PG_ERR_SCRAM}`;
  t.eqStr("a server nonce that is not ours", first("r=someone-else,s=c2FsdA==,i=4096"), scram);
  t.eqStr("a server nonce that adds nothing", first(`r=${CLIENT_NONCE},s=c2FsdA==,i=4096`), scram);
  t.eqStr("a server nonce with a space", first(`r=${CLIENT_NONCE}a b,s=c2FsdA==,i=4096`), scram);
  t.eqStr("no salt", first(`r=${CLIENT_NONCE}xyz,i=4096`), scram);
  t.eqStr("a salt that is not base64", first(`r=${CLIENT_NONCE}xyz,s=*,i=4096`), scram);
  t.eqStr("iterations under minIterations", first(`r=${CLIENT_NONCE}xyz,s=c2FsdA==,i=4095`), scram);
  t.eqStr("iterations over maxIterations", first(`r=${CLIENT_NONCE}xyz,s=c2FsdA==,i=100001`), scram);
  t.eqStr("iterations that would overflow", first(`r=${CLIENT_NONCE}xyz,s=c2FsdA==,i=99999999999999`), scram);
  t.eqStr("iterations that are not digits", first(`r=${CLIENT_NONCE}xyz,s=c2FsdA==,i=40x6`), scram);

  const sent: string = drain(proved());
  t.ok("SASLResponse: no channel binding, the joined nonce, a proof", sent.indexOf(`c=biws,r=${CLIENT_NONCE}xyz,p=`) > 0);
  t.ok("and a proof of 32 bytes", sent.length === sent.indexOf(",p=") + 3 + 44);
  // 32 bytes of zeros: the right length, but not the signature the password makes.
  const zeros: string = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  t.eqStr("a server signature the password does not make", final(`v=${zeros}`), `failed:${PG_ERR_SERVER_SIGNATURE}`);
  t.eqStr("a server signature of 31 bytes", final("v=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="), scram);
  t.eqStr("a server signature that is not base64", final("v=*"), scram);
  t.eqStr("a server final without v=", final(`x=${zeros}`), scram);
  t.eqStr("a server final of one byte", final("v"), scram);

  const skipped = open(config());
  feed(skipped, auth(10, z("SCRAM-SHA-256||")));
  t.ok("the password is held while SCRAM runs", !skipped.passwordWiped());
  t.eqStr("AuthenticationOk before the server proved the password", feed(skipped, auth(0, [])), scram);
  t.ok("a failed connection holds no password: its copy is zeros", skipped.passwordWiped());
};

const wipes = (t: Suite): void => {
  const held = open(config());
  t.ok("a new connection holds its copy of the password", !held.passwordWiped());
  feed(held, auth(10, z("SCRAM-SHA-256||")));
  t.ok("still after SASL starts", !held.passwordWiped());
  feed(held, auth(11, z(`r=${CLIENT_NONCE}xyz,s=c2FsdA==,i=4096`)));
  t.ok("zeros once the proof is computed", held.passwordWiped());
  const failing = open(config());
  t.eqStr("a framing failure", feed(failing, msg("R", z("ab"))), `failed:${PG_ERR_FRAME}`);
  t.ok("zeros after fail()", failing.passwordWiped());
  const dropped = open(config());
  dropped.dispose();
  t.ok("zeros after dispose()", dropped.passwordWiped());
  const trusted = open(config());
  feed(trusted, auth(0, []));
  t.ok("trust computes no proof: zeros once AuthenticationOk arrives", trusted.passwordWiped());
};

/** A connection fed AuthenticationOk, then a ParameterStatus `name` = `value`. */
const setting = (name: string, value: string): string => {
  const conn = open(config());
  feed(conn, auth(0, []));
  return feed(conn, msg("S", z(`${name}|${value}|`)));
};

const settings = (t: Suite): void => {
  const bad: string = `failed:${PG_ERR_SETTING}`;
  t.eqStr("DateStyle ISO", setting("DateStyle", "ISO"), "");
  t.eqStr("DateStyle ISO, MDY", setting("DateStyle", "ISO, MDY"), "");
  t.eqStr("DateStyle German, DMY", setting("DateStyle", "German, DMY"), bad);
  t.eqStr("DateStyle ISOX", setting("DateStyle", "ISOX"), bad);
  t.eqStr("DateStyle empty", setting("DateStyle", ""), bad);
  t.eqStr("TimeZone UTC", setting("TimeZone", "UTC"), "");
  t.eqStr("TimeZone Europe/Paris", setting("TimeZone", "Europe/Paris"), bad);
  t.eqStr("TimeZone UTC0", setting("TimeZone", "UTC0"), bad);
  const set = inGroup();
  t.eqStr("a SET TimeZone once ready fails the connection", feed(set, msg("S", z("TimeZone|Asia/Tokyo|"))), bad);
};

const serverErrors = (t: Suite): void => {
  const early = open(config());
  t.eqStr(
    "an error during startup fails the connection",
    feed(early, msg("E", z("SFATAL|VFATAL|C3D000|Mno database||"))),
    `failed:${PG_ERR_SERVER}`,
  );
  const e = early.lastError;
  t.eqStr("its code", e === null ? "" : e.code, "3D000");
  t.eqStr("its message", e === null ? "" : e.message, "no database");

  const fatal = inGroup();
  t.eqStr("FATAL once ready fails it too", feed(fatal, msg("E", z("VFATAL|C57P01|Mbye||"))), `failed:${PG_ERR_SERVER}`);

  const conn = inGroup();
  t.eqStr(
    "an ERROR ends the statement, then the group",
    feed(
      conn,
      cat(msg("E", z("SERREUR|VERROR|C23505|Mdup|Ddetail|Hhint|nuniq|P7||")), msg("Z", z("E"))),
    ),
    `${PG_ERROR},${PG_GROUP_DONE}`,
  );
  const err = conn.lastError;
  t.eqStr(
    "the non-localised severity, code, message, detail, hint, constraint, position",
    err === null ? "" : `${err.severity} ${err.code} ${err.message} ${err.detail} ${err.hint} ${err.constraint} ${err.position}`,
    "ERROR 23505 dup detail hint uniq 7",
  );
  t.ok("the group failed", conn.groupFailed);
  t.eqI32("in a failed transaction", conn.txStatus, 69);
  t.eqI32("nothing in flight", conn.inFlight, 0);

  const local = inGroup();
  feed(local, msg("N", z("SAVIS|C01000|Mw||")));
  const n = local.lastNotice;
  t.eqStr("a notice without V takes the localised severity", n === null ? "" : n.severity, "AVIS");
  t.eqStr("a notice does not end the group", feed(local, msg("Z", z("I"))), `${PG_GROUP_DONE}`);
  t.ok("whose statements did not fail", !local.groupFailed);

  const enc = open(config());
  t.eqStr("a client_encoding other than UTF8", feed(enc, msg("S", z("client_encoding|LATIN1|"))), `failed:${PG_ERR_ENCODING}`);
};

const lifecycle = (t: Suite): void => {
  const conn = ready(config());
  t.eqI32("the end of the stream", conn.closed(), PG_FAILED);
  t.eqI32("is a failure", conn.failure, PG_ERR_CLOSED);
  t.eqI32("reported once", conn.closed(), PG_FAILED);
  t.eqI32("the first cause stays", conn.failure, PG_ERR_CLOSED);
  const dropped = open(config());
  dropped.dispose();
  dropped.dispose();
  t.pass("dispose may be called twice");
  conn.terminate();
  t.eqStr("Terminate", drain(conn), "X|||<4>");
  const binding = ready(config());
  binding.prepare("q", "select $1", none());
  drain(binding);
  binding.bindStart("q");
  binding.paramInt(toI64(1));
  binding.terminate();
  t.eqStr("Terminate drops an open bind", drain(binding), "X|||<4>");
};

const builders = (t: Suite): void => {
  const conn = ready(config());
  t.ok("Parse and Describe", conn.prepare("q", "select $1", [23]));
  t.eqStr("their bytes", drain(conn), "P|||<22>q|select $1||<1>|||<23>D|||<7>Sq|");
  t.eqI32("a group is open", conn.inFlight, 1);
  t.ok("Bind", conn.bindStart("q"));
  conn.paramInt((toI64(-922337203) * toI64(1000000000) - toI64(685477580)) * toI64(10) - toI64(8));
  conn.paramText("hé");
  conn.paramNull();
  conn.paramBytes(z("abcdef"), 2, 3);
  conn.paramTextArray(["a\"b", "c\\d", ""]);
  conn.paramInt(toI64(0));
  t.ok("no sync while a bind is open", !conn.sync());
  t.ok("no prepare while a bind is open", !conn.prepare("r", "select 2", none()));
  conn.bindEnd();
  t.eqStr(
    "Bind with every parameter kind, then Execute",
    drain(conn),
    "B|||R|q||||<6>|||<20>-9223372036854775808|||<3>h<195><169><255><255><255><255>" +
      "|||<3>cde|||<18>{\"a\\\"b\",\"c\\\\d\",\"\"}|||<1>0||E|||<9>|||||",
  );
  t.ok("Sync", conn.sync());
  t.eqStr("its bytes", drain(conn), "S|||<4>");
  t.ok("no sync without a group", !conn.sync());
  t.ok("Close", conn.closeStatement("q"));
  t.eqStr("its bytes", drain(conn), "C|||<7>Sq|");
  t.ok("a NUL in a name is refused", !conn.prepare(`a${String.fromCharCode(0)}b`, "select 1", none()));
  t.ok("a NUL in SQL is refused", !conn.prepare("", `select ${String.fromCharCode(0)}`, none()));
  t.ok("a NUL in a closed name is refused", !conn.closeStatement(String.fromCharCode(0)));
  t.ok("a NUL in a bound name is refused", !conn.bindStart(String.fromCharCode(0)));
  t.eqStr("and nothing is written", drain(conn), "");

  const c = config();
  c.maxInFlight = 2;
  const capped = ready(c);
  capped.prepare("", "select 1", none());
  capped.sync();
  capped.prepare("", "select 1", none());
  t.ok("the open group may take more", capped.canSend());
  capped.sync();
  t.ok("maxInFlight groups sent: no more", !capped.canSend());
  t.ok("prepare is refused", !capped.prepare("", "select 1", none()));
  t.ok("bindStart is refused", !capped.bindStart(""));
  feed(capped, cat(msg("1", []), msg("n", [])));
  t.eqStr("a group done", feed(capped, msg("Z", z("I"))), `${PG_GROUP_DONE}`);
  t.ok("frees a place", capped.canSend());
  t.ok("before ready, nothing may be prepared", !open(config()).prepare("", "select 1", none()));
};

/** A RowDescription field: `name`, no table, type `oid` of `size` bytes, text. */
const field = (out: u8[], name: string, oid: i32, size: i32): void => {
  for (const b of z(`${name}|`)) {
    out.push(b);
  }
  pushI32(out, 0);
  pushI16(out, 0);
  pushI32(out, oid);
  pushI16(out, size);
  pushI32(out, -1);
  pushI16(out, 0);
};

const results = (t: Suite): void => {
  const conn = inGroup();
  const desc: u8[] = [];
  pushI16(desc, 2);
  field(desc, "id", 23, 4);
  t.eqI32("a field is 18 bytes after its name", toI32(desc.length), 2 + 3 + 18);
  field(desc, "ok", 16, 1);
  t.eqStr("RowDescription", feed(conn, msg("T", desc)), `${PG_DESCRIBED}`);
  t.eqI32("two columns", conn.columns, 2);
  t.eqI32("the first is int4", conn.columnType(0), 23);
  t.eqI32("the second bool", conn.columnType(1), 16);
  t.eqStr("a row", feed(conn, row(["-17", "t"], [])), `${PG_ROW}`);
  t.ok("int", conn.int(0) === toI64(-17));
  t.ok("bool", conn.bool(1));
  t.eqStr("columnText", conn.columnText(0), "-17");
  t.eqI32("colLength", conn.colLength(0), 3);
  t.eqI32("colStart points into the input buffer", toI32(conn.inputBuffer()[conn.colStart(1)]), 116);
  const long: string = nines(258);
  t.eqStr("a column of 258 bytes, its length in two bytes", feed(conn, row([long, "t"], [])), `${PG_ROW}`);
  t.eqI32("its length", conn.colLength(0), 258);
  t.ok("the next column follows it", conn.bool(1));
  t.eqStr("a row with a NULL", feed(conn, row(["", "f"], [true, false])), `${PG_ROW}`);
  t.ok("isNull", conn.isNull(0) && !conn.isNull(1));
  t.eqStr("columnText of NULL", conn.columnText(0), "");
  t.ok("int of NULL is 0", conn.int(0) === toI64(0));
  t.ok("and sets failed", conn.text.failed);
  conn.text.reset();
  const wide: string[] = [];
  for (let i: i32 = 0; i < 20; i++) {
    wide.push(`${i}`);
  }
  t.eqStr("a row wider than the column arrays grows them", feed(conn, row(wide, [])), `${PG_ROW}`);
  t.ok("its last column", conn.int(19) === toI64(19));
  t.eqStr("a tag", feed(conn, msg("C", z("INSERT 0 3|"))), `${PG_COMPLETE}`);
  t.ok("tagIs a whole word", conn.tagIs("INSERT"));
  t.ok("not a prefix of one", !conn.tagIs("INS"));
  t.ok("tagRows", conn.tagRows() === toI64(3));
  feed(conn, msg("C", z("CREATE TABLE|")));
  t.ok("a tag without a count", conn.tagRows() === toI64(-1));
  t.ok("tagIs of two words", conn.tagIs("CREATE TABLE"));
  feed(conn, msg("C", z("SELECT 99999999999999999999|")));
  conn.text.reset();
  t.ok("a count past an i64", conn.tagRows() === toI64(-1));
  t.ok("leaves text.failed alone", !conn.text.failed);
  conn.text.failed = true;
  feed(conn, msg("C", z("SELECT 5|")));
  t.ok("a count while text.failed is set", conn.tagRows() === toI64(5));
  t.ok("keeps it set", conn.text.failed);
  conn.text.reset();
  feed(conn, msg("I", []));
  t.ok("EmptyQueryResponse is the empty tag", conn.tagIs("") && !conn.tagIs("SELECT"));
  t.eqStr("NoData", feed(conn, msg("n", [])), `${PG_DESCRIBED}`);
  t.eqI32("no columns", conn.columns, 0);
  t.eqStr("ParseComplete, BindComplete, CloseComplete, ParameterDescription say nothing", feed(conn, cat(cat(cat(msg("1", []), msg("2", [])), msg("3", [])), msg("t", z("||")))), "");
  t.eqStr("a notice", feed(conn, msg("N", z("VWARNING|C01000|Mw||"))), `${PG_NOTICE}`);
  t.eqI32("counted", conn.notices, 1);
};

/** `n` copies of `x`. */
const repeat = (x: string, n: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < n; i++) {
    parts.push(x);
  }
  return parts.join("");
};

/** Whether `b` holds `want` from `at`. */
const same = (b: u8[], at: i32, want: u8[]): boolean => {
  for (let i: i32 = 0; i < toI32(want.length); i++) {
    if (at + i >= toI32(b.length) || b[at + i] !== want[i]) {
      return false;
    }
  }
  return true;
};

const output = (t: Suite): void => {
  const c = config();
  c.maxOutput = 1024;
  const conn = ready(c);
  // Parse and Describe of `sql` are 16 bytes more than it, and 17 stay free for bindEnd and Sync.
  t.ok("a prepare that would pass maxOutput is refused", !conn.prepare("", repeat("x", 992), none()));
  t.eqI32("and opens no group", conn.inFlight, 0);
  t.eqI32("and writes nothing", conn.outputEnd(), 0);
  t.ok("one byte less fits", conn.prepare("", repeat("x", 991), none()));
  t.eqI32("exactly maxOutput less the tail", conn.outputEnd(), 1024 - 17);
  t.ok("no Bind after it", !conn.bindStart(""));
  t.ok("Sync still fits", conn.sync());
  drain(conn);

  conn.prepare("", repeat("y", 500), none());
  conn.sync();
  t.eqI32("516 and 5 bytes queued", conn.outputEnd(), 521);
  const unsent: u8[] = slice(conn.outputBuffer(), 300, 521);
  conn.sent(300);
  t.eqI32("a partial send under half the buffer keeps its place", conn.outputStart(), 300);
  t.ok("a message that fits under maxOutput but not after the end", conn.prepare("", repeat("z", 600), none()));
  t.eqI32("moves the unsent bytes to the start", conn.outputStart(), 0);
  t.eqI32("instead of growing the buffer", toI32(conn.outputBuffer().length), 1024);
  t.ok("the unsent bytes as they were", same(conn.outputBuffer(), 0, unsent));
  t.eqI32("the new message after them", conn.outputEnd(), 221 + 616);
  t.ok("unsent bytes count against maxOutput", !conn.prepare("", repeat("w", 200), none()));
  conn.sent(600);
  t.eqI32("a send past half the buffer moves the rest to its start", conn.outputStart(), 0);
  t.eqI32("all of it", conn.outputEnd(), 237);
  t.ok("whose last bytes are the Describe", same(conn.outputBuffer(), 230, [toU8(68), toU8(0), toU8(0), toU8(0), toU8(6), toU8(83), toU8(0)]));

  drain(conn);
  conn.prepare("", repeat("t", 991), none());
  conn.sent(300);
  t.ok("a message that ends the buffer exactly", conn.prepare("", "t", none()));
  t.eqI32("keeps the sent bytes before it", conn.outputEnd(), 1024);
  t.ok("Sync after it", conn.sync());
  t.eqI32("moves the unsent bytes to the start too", conn.outputStart(), 0);
  t.eqI32("rather than double the buffer", toI32(conn.outputBuffer().length), 1024);

  const binding = ready(c);
  binding.prepare("q", "select $1", none());
  binding.sync();
  drain(binding);
  binding.bindStart("q");
  t.eqI32("an open Bind is not yet sendable", binding.outputEnd(), 0);
  t.ok("a parameter that would pass maxOutput is refused", !binding.paramText(repeat("p", 1000)));
  t.ok("a smaller one fits", binding.paramText("ok"));
  t.ok("bindEnd is never refused for room", binding.bindEnd());
  t.ok("nor is Sync", binding.sync());
  t.eqStr("the refused parameter left nothing behind", drain(binding), "B|||<19>|q||||<1>|||<2>ok||E|||<9>|||||S|||<4>");
};

const params = (t: Suite): void => {
  const conn = ready(config());
  t.ok("paramText without a bind is refused", !conn.paramText("x"));
  t.ok("paramBytes too", !conn.paramBytes(z("x"), 0, 1));
  t.ok("paramNull too", !conn.paramNull());
  t.ok("paramInt too", !conn.paramInt(toI64(1)));
  t.ok("paramTextArray too", !conn.paramTextArray(["x"]));
  t.ok("bindEnd too", !conn.bindEnd());
  t.eqStr("and nothing is written", drain(conn), "");
  conn.prepare("q", "select $1", none());
  conn.sync();
  drain(conn);
  conn.bindStart("q");
  const b: u8[] = z("abc");
  t.ok("paramBytes: a negative start", !conn.paramBytes(b, -1, 1));
  t.ok("paramBytes: a negative length", !conn.paramBytes(b, 0, -1));
  t.ok("paramBytes: a window past the end", !conn.paramBytes(b, 2, 2));
  t.ok("paramBytes: a window that would overflow", !conn.paramBytes(b, 2, 2147483647));
  t.ok("paramBytes: the whole array", conn.paramBytes(b, 0, 3));
  t.ok("paramBytes: an empty window at the end", conn.paramBytes(b, 3, 0));
  conn.bindEnd();
  conn.sync();
  t.eqStr("only the two good windows were bound", drain(conn), "B|||<24>|q||||<2>|||<3>abc||||||E|||<9>|||||S|||<4>");
};

/** A RowDescription of one int4 column. */
const oneInt = (): u8[] => {
  const desc: u8[] = [];
  pushI16(desc, 1);
  field(desc, "n", 23, 4);
  return msg("T", desc);
};

/** The server's answer to group `i`: Parse, Describe, Bind, one row holding `i`, its tag, ReadyForQuery. */
const answer = (i: i32): u8[] => {
  const head: u8[] = cat(cat(msg("1", []), msg("t", z("||"))), oneInt());
  return cat(cat(cat(cat(head, msg("2", [])), row([`${i}`], [])), msg("C", z("SELECT 1|"))), msg("Z", z("I")));
};

/** Feeds `bytes`; answers each row's int, `done` for each group, `failed:<code>` for a failure. */
const values = (conn: PgConnection, bytes: u8[]): string => {
  const out: string[] = [];
  let fed: i32 = 0;
  while (true) {
    fed += conn.receive(bytes, fed, toI32(bytes.length) - fed);
    const event: i32 = conn.next();
    if (event === PG_FAILED) {
      out.push(`failed:${conn.failure}`);
      break;
    }
    if (event === PG_NEED_MORE) {
      if (fed === toI32(bytes.length)) {
        break;
      }
    } else if (event === PG_ROW) {
      out.push(`${conn.int(0)}`);
    } else if (event === PG_GROUP_DONE) {
      out.push("done");
    }
  }
  return out.join(",");
};

/** Queues group `i`: prepare `s<i>`, bind it to `i`, sync. */
const group = (conn: PgConnection, i: i32): boolean => {
  const name: string = `s${i}`;
  return conn.prepare(name, "select $1::int4", [23]) && conn.bindStart(name) && conn.paramInt(toI64(i)) && conn.bindEnd() && conn.sync();
};

const pipeline = (t: Suite): void => {
  const conn = ready(config());
  let queued: i32 = 0;
  for (let i: i32 = 1; i <= 16; i++) {
    if (group(conn, i)) {
      queued += 1;
    }
  }
  t.eqI32("sixteen groups, the default maxInFlight, go out unanswered", queued, 16);
  t.eqI32("all in flight", conn.inFlight, 16);
  t.ok("a seventeenth may not start", !conn.canSend() && !conn.prepare("s17", "select 1", none()));
  drain(conn);
  t.eqStr("the first answer frees one place", values(conn, answer(1)), "1,done");
  t.ok("so the seventeenth goes out", group(conn, 17));
  t.eqI32("sixteen in flight again", conn.inFlight, 16);
  drain(conn);
  let rest: u8[] = [];
  for (let i: i32 = 2; i <= 17; i++) {
    rest = cat(rest, answer(i));
  }
  const want: string[] = [];
  for (let i: i32 = 2; i <= 17; i++) {
    want.push(`${i},done`);
  }
  t.eqStr("the answers come back in the order the groups were sent", values(conn, rest), want.join(","));
  t.eqI32("nothing in flight", conn.inFlight, 0);
  t.eqStr("one answer more than was asked for", values(conn, answer(18)), `failed:${PG_ERR_UNEXPECTED}`);
};

const intOf = (p: PgText, text: string): string => {
  p.reset();
  const v: i64 = p.int(z(text), 0, toI32(text.length));
  return p.failed ? "failed" : `${v}`;
};

const ints = (t: Suite): void => {
  const p = new PgText();
  t.eqStr("int", intOf(p, "123"), "123");
  t.eqStr("int: negative", intOf(p, "-45"), "-45");
  t.eqStr("int: the most negative i64", intOf(p, "-9223372036854775808"), "-9223372036854775808");
  t.eqStr("int: the largest i64", intOf(p, "9223372036854775807"), "9223372036854775807");
  t.eqStr("int: one past the largest", intOf(p, "9223372036854775808"), "failed");
  t.eqStr("int: one past the most negative", intOf(p, "-9223372036854775809"), "failed");
  t.eqStr("int: empty", intOf(p, ""), "failed");
  t.eqStr("int: a sign alone", intOf(p, "-"), "failed");
  t.eqStr("int: a letter", intOf(p, "12a"), "failed");
  t.eqStr("int: a plus sign", intOf(p, "+1"), "failed");
  p.reset();
  p.int(z("1"), 0, 2);
  t.ok("int: a window past the buffer", p.failed);
  p.reset();
  t.ok("bool: t", p.bool(z("t"), 0, 1) && !p.failed);
  t.ok("bool: f", !p.bool(z("f"), 0, 1) && !p.failed);
  t.ok("bool: anything else", !p.bool(z("true"), 0, 4) && p.failed);
};

const ts = (p: PgText, text: string, at: i32): string => {
  const out: u8[] = new Array<u8>(30);
  p.reset();
  const n: i32 = p.timestamp(z(text), 0, toI32(text.length), out, at);
  return n < 0 || p.failed ? "failed" : String.fromBytes(out, at, at + n);
};

const timestamps = (t: Suite): void => {
  const p = new PgText();
  t.eqStr("timestamptz", ts(p, "2024-01-02 03:04:05.123456+00", 0), "2024-01-02T03:04:05.123Z");
  t.eqStr("timestamptz, one fraction digit", ts(p, "2024-01-02 03:04:05.5+00", 0), "2024-01-02T03:04:05.500Z");
  t.eqStr("timestamp, no fraction, no offset", ts(p, "1999-12-31 23:59:59", 6), "1999-12-31T23:59:59.000Z");
  t.eqStr("an offset other than +00", ts(p, "2024-01-02 03:04:05+01", 0), "failed");
  t.eqStr("infinity", ts(p, "infinity", 0), "failed");
  t.eqStr("BC", ts(p, "0044-03-15 12:00:00+00 BC", 0), "failed");
  t.eqStr("year 0000", ts(p, "0000-01-01 00:00:00", 0), "failed");
  const untouched: u8[] = z("unchanged");
  p.reset();
  p.timestamp(z("0000-01-01 00:00:00"), 0, 19, untouched, 0);
  t.eqStr("leaves out as it was", String.fromBytes(untouched, 0, 9), "unchanged");
  t.eqStr("a year past 9999", ts(p, "10000-01-01 00:00:00", 0), "failed");
  t.eqStr("seven fraction digits", ts(p, "2024-01-02 03:04:05.1234567", 0), "failed");
  t.eqStr("a dot without digits", ts(p, "2024-01-02 03:04:05.+00", 0), "failed");
  t.eqStr("a T where the space goes", ts(p, "2024-01-02T03:04:05", 0), "failed");
  t.eqStr("year 0001", ts(p, "0001-01-01 00:00:00", 0), "0001-01-01T00:00:00.000Z");
  t.eqStr("year 1000", ts(p, "1000-01-01 00:00:00", 0), "1000-01-01T00:00:00.000Z");
  t.eqStr("a letter in a digit's place", ts(p, "2024-0a-02 03:04:05", 0), "failed");
  t.eqStr("a colon in a digit's place", ts(p, "2024-01-02 03:0::05", 0), "failed");
  t.eqStr("a digit in a separator's place", ts(p, "2024-01-02 03:04505", 0), "failed");
  t.eqStr("a separator moved one place", ts(p, "202-401-02 03:04:05", 0), "failed");
  t.eqStr("the space and a dash swapped", ts(p, "2024 01-02-03:04:05", 0), "failed");
  t.eqStr("no room in out", ts(p, "2024-01-02 03:04:05", 7), "failed");
};

/** The elements of `text`, as the walker reads them. */
const walk = (w: PgArrayWalker, text: string): string => {
  const out: u8[] = new Array<u8>(16);
  const b: u8[] = z(text);
  w.begin(b, 0, toI32(b.length));
  const items: string[] = [];
  while (true) {
    const r: i32 = w.next();
    if (r === PG_ARRAY_END) {
      return items.join(",");
    }
    if (r === PG_ARRAY_BAD) {
      items.push("BAD");
      return items.join(",");
    }
    if (r === PG_ARRAY_NULL) {
      items.push("NULL");
    } else if (r === PG_ARRAY_ELEMENT) {
      const n: i32 = w.copy(out, 0);
      items.push(n < 0 ? "LONG" : `<${String.fromBytes(out, 0, n)}>${w.escaped ? "e" : ""}`);
    }
  }
};

const arrays = (t: Suite): void => {
  const w = new PgArrayWalker();
  t.eqStr("an empty array", walk(w, "{}"), "");
  t.eqStr("plain, NULL, quoted, escaped", walk(w, "{a,NULL,\"x y\",\"q\\\"r\"}"), "<a>,NULL,<x y>,<q\"r>e");
  t.eqStr("null in any case", walk(w, "{nUlL}"), "NULL");
  t.eqStr("a quoted NULL is text", walk(w, "{\"NULL\"}"), "<NULL>");
  t.eqStr("an element longer than out", walk(w, "{abcdefghijklmnopq}"), "LONG");
  t.eqStr("not braced", walk(w, "a,b"), "BAD");
  t.eqStr("nested", walk(w, "{{1},{2}}"), "BAD");
  t.eqStr("dimensions", walk(w, "[1:1]={a}"), "BAD");
  t.eqStr("an empty element", walk(w, "{a,,b}"), "<a>,BAD");
  t.eqStr("an unclosed quote", walk(w, "{\"open}"), "BAD");
  t.eqStr("text after a quote", walk(w, "{\"a\"b}"), "BAD");
  t.eqStr("a space unquoted", walk(w, "{a b}"), "BAD");
  w.begin(z("{a}"), 0, 1);
  t.eqI32("a window too short", w.next(), PG_ARRAY_BAD);
  t.eqI32("stays bad", w.next(), PG_ARRAY_BAD);
};

/** A ready connection with a Bind of `q` open. */
const bound = (c: PgConfig): PgConnection => {
  const conn = ready(c);
  conn.prepare("q", "select $1", none());
  conn.sync();
  drain(conn);
  conn.bindStart("q");
  return conn;
};

/**
 * Ends the open Bind of `q` and answers its one parameter: the length word,
 * then the bytes as `drain` shows them; the Bind starts `at` bytes into the
 * queued output, and everything is marked sent.
 */
const onlyParam = (conn: PgConnection, at: i32): string => {
  conn.bindEnd();
  const out: u8[] = conn.outputBuffer();
  const p: i32 = conn.outputStart() + at + 12;
  const n: i32 = getI32BE(out, p);
  const parts: string[] = [`${toI32(getU16BE(out, p - 2))} of ${n}:`];
  for (let i: i32 = p + 4; i < p + 4 + n; i++) {
    const c: i32 = toI32(out[i]);
    parts.push(c === 0 ? "|" : c < 32 || c > 126 ? `<${c}>` : String.fromCharCode(c));
  }
  conn.sent(conn.outputEnd() - conn.outputStart());
  return parts.join("");
};

const intArrays = (t: Suite): void => {
  const empty: i64[] = [];
  let conn = bound(config());
  t.ok("paramIntArray: the empty array", conn.paramIntArray(empty, 0, 0));
  t.eqStr("is {}", onlyParam(conn, 0), "1 of 2:{}");
  const min: i64 = (toI64(-922337203) * toI64(1000000000) - toI64(685477580)) * toI64(10) - toI64(8);
  const values: i64[] = [toI64(7), toI64(-1), toI64(0), min, -(min + toI64(1))];
  conn = bound(config());
  conn.paramIntArray(values, 0, 5);
  t.eqStr("every value in decimal, the most negative too", onlyParam(conn, 0), "1 of 49:{7,-1,0,-9223372036854775808,9223372036854775807}");
  conn = bound(config());
  conn.paramIntArray(values, 1, 2);
  t.eqStr("a window of the array", onlyParam(conn, 0), "1 of 6:{-1,0}");
  conn = bound(config());
  conn.paramIntArray(values, 5, 0);
  t.eqStr("an empty window at its end", onlyParam(conn, 0), "1 of 2:{}");

  const c = config();
  c.maxOutput = 1024;
  // The Bind's first 12 bytes are queued and 17 stay free: 995 for the
  // parameter, its length word among them; 91 ten-digit values take 1002.
  const big: i64[] = [];
  for (let i: i32 = 0; i < 91; i++) {
    big.push(toI64(1000000000));
  }
  conn = bound(c);
  t.ok("an int8[] that would pass maxOutput is refused", !conn.paramIntArray(big, 0, 91));
  t.ok("its exact size is asked for: one value less fits", conn.paramIntArray(big, 1, 90));
  t.eqStr("and the refused one left nothing behind", onlyParam(conn, 0).slice(0, 12), "1 of 991:{10");
  t.ok("without a bind, refused", !conn.paramIntArray(big, 0, 1));
};

const arrayBuilder = (t: Suite): void => {
  let conn = bound(config());
  t.ok("arrayStart", conn.arrayStart());
  conn.arrayEnd();
  t.eqStr("no elements: the empty array", onlyParam(conn, 0), "1 of 2:{}");

  conn = bound(config());
  conn.arrayStart();
  t.ok("a NULL element", conn.arrayNull());
  const awkward: string[] = ["\"", "\\", ",", "{", "}", " x y ", "NULL", "", "é"];
  for (const item of awkward) {
    const b: u8[] = z(item);
    t.ok(`an element of ${toI32(b.length)} bytes`, conn.arrayElement(b, 0, toI32(b.length)));
  }
  conn.arrayEnd();
  t.eqStr(
    "NULL unquoted, every text element quoted, \" and \\ escaped, UTF-8 as it is",
    onlyParam(conn, 0),
    "1 of 51:{NULL,\"\\\"\",\"\\\\\",\",\",\"{\",\"}\",\" x y \",\"NULL\",\"\",\"<195><169>\"}",
  );

  conn = bound(config());
  conn.paramInt(toI64(1));
  conn.arrayStart();
  conn.arrayElement(z("abcdef"), 2, 3);
  conn.arrayNull();
  t.ok("no sync while an array is open", !conn.sync());
  t.ok("no prepare", !conn.prepare("r", "select 2", none()));
  t.ok("no closeStatement", !conn.closeStatement("q"));
  t.ok("no bindStart", !conn.bindStart("q"));
  conn.arrayEnd();
  conn.paramText("z");
  t.ok("bindEnd after arrayEnd", conn.bindEnd());
  t.eqStr(
    "an array between two parameters is one parameter, its window bound",
    drain(conn),
    "B|||'|q||||<3>|||<1>1|||<12>{\"cde\",NULL}|||<1>z||E|||<9>|||||",
  );

  const c = config();
  c.maxOutput = 1024;
  // 12 bytes of Bind, the length word and `{` are queued and 17 stay free:
  // 990 for the first element, its quotes and the `}` it owes.
  conn = bound(c);
  conn.arrayStart();
  const quotes: u8[] = z(repeat("\"", 494));
  t.ok("an element whose escapes pass maxOutput is refused", !conn.arrayElement(quotes, 0, 494));
  t.ok("its escapes are counted: one less fits", conn.arrayElement(quotes, 1, 493));
  conn.arrayEnd();
  t.eqStr("and the refused one left nothing behind", onlyParam(conn, 0).slice(0, 14), "1 of 990:{\"\\\"\\");

  conn = bound(c);
  conn.arrayStart();
  const long: u8[] = z(repeat("a", 988));
  t.ok("an element that would pass maxOutput is refused", !conn.arrayElement(long, 0, 988));
  t.ok("one byte less fits", conn.arrayElement(long, 1, 987));
  t.ok("a NULL after it is refused", !conn.arrayNull());
  t.ok("as is another element", !conn.arrayElement(long, 0, 0));
  conn.arrayEnd();
  t.ok("the array still ends", conn.bindEnd());
  t.ok("and Sync fits", conn.sync());
  t.eqStr("with the element that fit", drain(conn), `B||<3><240>|q||||<1>||<3><223>{"${repeat("a", 987)}"}||E|||<9>|||||S|||<4>`);

  conn = ready(c);
  t.ok("without a bind, arrayStart is refused", !conn.arrayStart());
  conn.prepare("", repeat("y", 500), none());
  conn.sync();
  const unsent: u8[] = slice(conn.outputBuffer(), 300, 521);
  conn.sent(300);
  conn.bindStart("q");
  conn.arrayStart();
  t.eqI32("an open array with sent bytes before it", conn.outputStart(), 300);
  t.ok("an element that fits under maxOutput but not after the end", conn.arrayElement(long, 0, 500));
  t.eqI32("moves the unsent bytes to the start", conn.outputStart(), 0);
  t.eqI32("instead of growing the buffer", toI32(conn.outputBuffer().length), 1024);
  conn.arrayNull();
  conn.arrayEnd();
  t.ok("the unsent bytes as they were", same(conn.outputBuffer(), 0, unsent));
  t.eqStr("the array's length patched where it moved to", onlyParam(conn, 221).slice(0, 14), "1 of 509:{\"aaa");

  conn = bound(config());
  conn.arrayStart();
  conn.arrayNull();
  conn.terminate();
  t.eqStr("terminate drops an open array with its bind", drain(conn), "X|||<4>");
  t.ok("and leaves none open", !conn.paramText("x"));

  conn = bound(config());
  conn.arrayStart();
  const min: i64 = (toI64(-922337203) * toI64(1000000000) - toI64(685477580)) * toI64(10) - toI64(8);
  t.ok("arrayInt", conn.arrayInt(toI64(7)));
  conn.arrayNull();
  conn.arrayInt(min);
  conn.arrayInt(toI64(0));
  conn.arrayEnd();
  t.eqStr("arrayInt writes decimal, unquoted, the most negative too", onlyParam(conn, 0), "1 of 31:{7,NULL,-9223372036854775808,0}");

  // 12 bytes of Bind, the length word and `{` are queued and 17 stay free:
  // 990 for the elements and the `}` they owe.
  conn = bound(c);
  conn.arrayStart();
  conn.arrayElement(long, 0, 975);
  t.ok("an int whose digits would pass maxOutput is refused", !conn.arrayInt(toI64(-1000000000) * toI64(10)));
  t.ok("one digit less fits", conn.arrayInt(toI64(-1000000000)));
  conn.arrayEnd();
  t.eqStr("and the refused one left nothing behind", onlyParam(conn, 0).slice(983), "aaa\",-1000000000}");

  conn = ready(config());
  t.ok("bindCancel with no bind open is refused", !conn.bindCancel());
  conn.prepare("q", "select $1", none());
  conn.sync();
  drain(conn);
  conn.bindStart("q");
  conn.arrayStart();
  conn.arrayInt(toI64(1));
  t.eqI32("a bind opens a group, beside the prepare's unanswered one", conn.inFlight, 2);
  t.ok("bindCancel", conn.bindCancel());
  t.eqStr("drops the bind and its open array, unsent", drain(conn), "");
  t.eqI32("and closes the group it opened", conn.inFlight, 1);
  t.ok("so sync has no group to end", !conn.sync());
  t.ok("a parameter after it is refused: no bind is open", !conn.paramInt(toI64(1)));
  conn.prepare("r", "select 2", none());
  conn.bindStart("q");
  conn.bindCancel();
  t.eqI32("a bind in a group already open leaves it open", conn.inFlight, 2);
  t.ok("so sync still ends it", conn.sync());
  t.eqStr("with only what was queued before the bind", drain(conn).slice(0, 1), "P");
};

/** A DataRow of binary `columns`, each the bytes as they are. */
const binaryRow = (columns: u8[][]): u8[] => {
  const body: u8[] = [];
  pushI16(body, toI32(columns.length));
  for (const col of columns) {
    pushI32(body, toI32(col.length));
    for (const b of col) {
      body.push(b);
    }
  }
  return msg("D", body);
};

/** `billions` * 10^9 + `rest`, for an i64 no i32 literal spells; both parts take the sign. */
const big = (billions: i32, rest: i32): i64 => toI64(billions) * toI64(1000000000) + toI64(rest);

/** No bytes. */
const noBytes = (): u8[] => new Array<u8>(0);

/** `v` as `n` big-endian bytes, `n` 2, 4 or 8. */
const be = (v: i64, n: i32): u8[] => {
  const out: u8[] = new Array<u8>(8);
  setI64BE(out, 0, v);
  return slice(out, 8 - n, 8);
};

/** The most negative i64, which a literal cannot spell. */
const MIN_I64 = (): i64 => (toI64(-922337203) * toI64(1000000000) - toI64(685477580)) * toI64(10) - toI64(8);

const binaryBinds = (t: Suite): void => {
  const conn = ready(config());
  conn.prepare("q", "select $1", none());
  conn.sync();
  drain(conn);
  t.ok("bindStartBinary", conn.bindStartBinary("q"));
  conn.paramInt(toI64(7));
  t.ok("bindEnd", conn.bindEnd());
  t.eqStr("one result format code, 1: every column binary", drain(conn), "B|||<20>|q||||<1>|||<1>7|<1>|<1>E|||<9>|||||");
  conn.bindStart("q");
  conn.paramInt(toI64(7));
  conn.bindEnd();
  t.eqStr("the next bindStart is text again: no format codes", drain(conn), "B|||<18>|q||||<1>|||<1>7||E|||<9>|||||");
  conn.bindStartBinary("q");
  conn.bindCancel();
  conn.bindStart("q");
  conn.bindEnd();
  t.eqStr("nor after a binary bind cancelled", drain(conn), "B|||<13>|q|||||||E|||<9>|||||");
  conn.sync();
  drain(conn);

  // Every bind keeps 17 bytes free for bindEnd and Sync; a binary one keeps 19.
  // A Bind of `q` is 12 bytes before its parameters, one of `n` bytes 4 + n more.
  const c = config();
  c.maxOutput = 1024;
  const text = ready(c);
  text.bindStart("q");
  t.ok("a text bind takes a parameter up to 17 short of maxOutput", text.paramText(repeat("p", 1024 - 17 - 12 - 4)));
  text.bindEnd();
  text.sync();
  t.eqI32("its bindEnd and Sync fill maxOutput exactly", text.outputEnd(), 1024);
  const binary = ready(c);
  binary.bindStartBinary("q");
  t.ok("a binary bind refuses that one", !binary.paramText(repeat("p", 1024 - 17 - 12 - 4)));
  t.ok("and takes one two bytes shorter", binary.paramText(repeat("p", 1024 - 19 - 12 - 4)));
  t.ok("bindEnd is never refused for room", binary.bindEnd());
  t.ok("nor is Sync", binary.sync());
  t.eqI32("which fill maxOutput exactly, two bytes more", binary.outputEnd(), 1024);
  // A prepare of 980 bytes of SQL queues 996, which leaves the 11 bytes of an
  // unnamed text Bind and not the 13 a binary one keeps.
  const full = ready(c);
  full.prepare("", repeat("x", 1024 - 17 - 16 - 11), none());
  t.ok("bindStartBinary keeps its two bytes too", !full.bindStartBinary(""));
  t.ok("where bindStart fits", full.bindStart(""));
};

const binaryRows = (t: Suite): void => {
  const conn = inGroup();
  const ts: u8[] = new Array<u8>(24);
  t.eqStr(
    "a binary row",
    feed(conn, binaryRow([be(toI64(-2), 2), be(toI64(-40000), 4), be(MIN_I64(), 8), [toU8(1)], z("hi"), be(big(820540, 759409876), 8), noBytes()])),
    `${PG_ROW}`,
  );
  t.ok("int2", conn.binaryInt(0) === toI64(-2));
  t.ok("int4", conn.binaryInt(1) === toI64(-40000));
  t.ok("int8", conn.binaryInt(2) === MIN_I64());
  t.ok("bool", conn.binaryBool(3));
  t.eqStr("text reads as it does in text format", conn.columnText(4), "hi");
  t.ok("a timestamptz's microseconds", conn.binaryInt(5) === big(820540, 759409876));
  const n: i32 = conn.binary.timestamp(conn.inputBuffer(), conn.colStart(5), conn.colLength(5), ts, 0);
  t.eqStr("and as a time", String.fromBytes(ts, 0, n), "2025-12-31T23:59:19.409Z");
  t.ok("nothing failed", !conn.binary.failed && !conn.text.failed);
  t.eqI32("an empty column is not NULL", conn.colLength(6), 0);
  t.ok("an int of no bytes fails", conn.binaryInt(6) === toI64(0) && conn.binary.failed);
  conn.binary.reset();
  const f: u8[] = new Array<u8>(8);
  setF64BE(f, 0, -1.5);
  t.eqStr("a row with a NULL", feed(conn, binaryRow([f, z("t")])), `${PG_ROW}`);
  t.ok("float8", conn.binaryFloat(0) === -1.5);
  t.ok("a text bool is not a binary one", !conn.binaryBool(1) && conn.binary.failed);
  t.ok("binary failures leave text.failed alone", !conn.text.failed);
};

/** `b` read as an int by `p`, or `failed`. */
const binInt = (p: PgBinary, b: u8[]): string => {
  p.reset();
  const v: i64 = p.int(b, 0, toI32(b.length));
  return p.failed ? "failed" : `${v}`;
};

const binaryInts = (t: Suite): void => {
  const p = new PgBinary();
  t.eqStr("int2: 0", binInt(p, be(toI64(0), 2)), "0");
  t.eqStr("int2: -1", binInt(p, be(toI64(-1), 2)), "-1");
  t.eqStr("int2: the largest", binInt(p, be(toI64(32767), 2)), "32767");
  t.eqStr("int2: the most negative", binInt(p, be(toI64(-32768), 2)), "-32768");
  t.eqStr("int4: -1", binInt(p, be(toI64(-1), 4)), "-1");
  t.eqStr("int4: the largest", binInt(p, be(toI64(2147483647), 4)), "2147483647");
  t.eqStr("int4: the most negative", binInt(p, be(big(-2, -147483648), 4)), "-2147483648");
  t.eqStr("int8: -1", binInt(p, be(toI64(-1), 8)), "-1");
  t.eqStr("int8: the largest", binInt(p, be(-(MIN_I64() + toI64(1)), 8)), "9223372036854775807");
  t.eqStr("int8: the most negative", binInt(p, be(MIN_I64(), 8)), "-9223372036854775808");
  t.eqStr("int8: past 2^53", binInt(p, be(big(9007199, 254740993), 8)), "9007199254740993");
  t.eqStr("one byte", binInt(p, [toU8(1)]), "failed");
  t.eqStr("three bytes", binInt(p, [toU8(0), toU8(0), toU8(1)]), "failed");
  t.eqStr("no bytes", binInt(p, noBytes()), "failed");
  p.reset();
  p.int(be(toI64(1), 4), 1, 4);
  t.ok("a window past the buffer", p.failed);
  p.reset();
  p.int(be(toI64(1), 4), -1, 4);
  t.ok("a window before it", p.failed);
  p.reset();
  p.int(be(toI64(1), 4), 0, -1);
  t.ok("NULL's length", p.failed);
  p.reset();
  t.ok("bool: 1", p.bool([toU8(1)], 0, 1) && !p.failed);
  t.ok("bool: 0", !p.bool([toU8(0)], 0, 1) && !p.failed);
  t.ok("bool: 2", !p.bool([toU8(2)], 0, 1) && p.failed);
  p.reset();
  t.ok("bool: two bytes", !p.bool([toU8(0), toU8(1)], 0, 2) && p.failed);
  p.reset();
  const f: u8[] = new Array<u8>(8);
  setF64BE(f, 0, 0.1);
  t.ok("float8", p.float(f, 0, 8) === 0.1 && !p.failed);
  t.ok("float8: four bytes", p.float(f, 0, 4) === 0 && p.failed);
  p.reset();
  p.float(f, 1, 8);
  t.ok("float8: a window past the buffer", p.failed);
};

/** `micros` as `p.iso` writes it at `at`, or `failed`. */
const iso = (p: PgBinary, micros: i64, at: i32): string => {
  const out: u8[] = new Array<u8>(30);
  p.reset();
  const n: i32 = p.iso(micros, out, at);
  return n < 0 || p.failed ? "failed" : String.fromBytes(out, at, at + n);
};

/** `micros` as an 8-byte column through `p.timestamp`, or `failed`. */
const binTs = (p: PgBinary, micros: i64): string => {
  const out: u8[] = new Array<u8>(24);
  p.reset();
  const n: i32 = p.timestamp(be(micros, 8), 0, 8, out, 0);
  return n < 0 || p.failed ? "failed" : String.fromBytes(out, 0, n);
};

const binaryTimes = (t: Suite): void => {
  const p = new PgBinary();
  t.eqStr("the epoch", iso(p, toI64(0), 0), "2000-01-01T00:00:00.000Z");
  t.eqStr("a time", iso(p, big(820540, 759409876), 0), "2025-12-31T23:59:19.409Z");
  t.eqStr("microseconds are cut, not rounded", iso(p, big(820540, 759409999), 0), "2025-12-31T23:59:19.409Z");
  t.eqStr("one microsecond before 2000", iso(p, toI64(-1), 0), "1999-12-31T23:59:59.999Z");
  t.eqStr("one millisecond before 2000", iso(p, toI64(-1000), 0), "1999-12-31T23:59:59.999Z");
  t.eqStr("one millisecond and one microsecond before", iso(p, toI64(-1001), 0), "1999-12-31T23:59:59.998Z");
  t.eqStr("1970", iso(p, big(-946684, -800000000), 3), "1970-01-01T00:00:00.000Z");
  t.eqStr("2000-02-29, a leap day of a 400th year", iso(p, big(5140, 800000000), 0), "2000-02-29T12:00:00.000Z");
  t.eqStr("the last microsecond of 2024-02-29", iso(p, big(762566, 399999999), 0), "2024-02-29T23:59:59.999Z");
  t.eqStr("the next", iso(p, big(762566, 400000000), 0), "2024-03-01T00:00:00.000Z");
  t.eqStr("2100 is no leap year", iso(p, big(3160857, 599999999), 0), "2100-02-28T23:59:59.999Z");
  t.eqStr("its 28 February is followed by 1 March", iso(p, big(3160857, 600000000), 0), "2100-03-01T00:00:00.000Z");
  t.eqStr("nor is 1900", iso(p, big(-3150576, 0), 0), "1900-03-01T00:00:00.000Z");
  t.eqStr("1600-02-29, before 2000, cut toward the past", iso(p, big(-12617683, -199999500), 0), "1600-02-29T00:00:00.000Z");
  t.eqStr("the first time of year 0001", iso(p, big(-63082281, -600000000), 0), "0001-01-01T00:00:00.000Z");
  t.eqStr("one microsecond before it", iso(p, big(-63082281, -600000001), 0), "failed");
  t.eqStr("the last time of year 9999", iso(p, big(252455615, 999999999), 0), "9999-12-31T23:59:59.999Z");
  t.eqStr("one microsecond after it", iso(p, big(252455616, 0), 0), "failed");
  t.eqStr("infinity", iso(p, -(MIN_I64() + toI64(1)), 0), "failed");
  t.eqStr("-infinity", iso(p, MIN_I64(), 0), "failed");
  t.eqStr("no room in out", iso(p, toI64(0), 7), "failed");
  t.eqStr("a negative at", iso(p, toI64(0), -1), "failed");
  const untouched: u8[] = z("unchanged");
  p.reset();
  p.iso(MIN_I64(), untouched, 0);
  t.eqStr("leaves out as it was", String.fromBytes(untouched, 0, 9), "unchanged");
  t.eqStr("timestamp: a column", binTs(p, toI64(-1)), "1999-12-31T23:59:59.999Z");
  t.eqStr("timestamp: infinity", binTs(p, -(MIN_I64() + toI64(1))), "failed");
  p.reset();
  const out: u8[] = new Array<u8>(24);
  t.ok("timestamp: four bytes", p.timestamp(be(toI64(0), 4), 0, 4, out, 0) === -1 && p.failed);
  const text = new PgText();
  const same: u8[] = new Array<u8>(24);
  text.timestamp(z("2025-12-31 23:59:19.409876+00"), 0, 29, same, 0);
  t.eqStr("the text decoder writes the same", String.fromBytes(same, 0, 24), iso(p, big(820540, 759409876), 0));
};

/** An element of `n` bytes holding `v`, as an array's length word and its bytes. */
const elem = (v: i64, n: i32): u8[] => {
  const out: u8[] = [];
  pushI32(out, n);
  for (const b of be(v, n)) {
    out.push(b);
  }
  return out;
};

/** A NULL element: the length word -1 and no bytes. */
const nullElem = (): u8[] => {
  const out: u8[] = [];
  pushI32(out, -1);
  return out;
};

/** A binary array: its header, one dimension of `dim` elements when `ndim` is 1, then `elems` as they are. */
const arrayOf = (ndim: i32, hasNull: i32, oid: i32, dim: i32, elems: u8[][]): u8[] => {
  const out: u8[] = [];
  pushI32(out, ndim);
  pushI32(out, hasNull);
  pushI32(out, oid);
  if (ndim === 1) {
    pushI32(out, dim);
    pushI32(out, 1);
  }
  for (const e of elems) {
    for (const b of e) {
      out.push(b);
    }
  }
  return out;
};

/** `b` walked by `w` over `p`: its elements' ints, NULL, then how the walk ended, and `failed`. */
const walkArray = (w: PgBinaryArray, p: PgBinary, b: u8[]): string => {
  p.reset();
  w.begin(b, 0, toI32(b.length));
  const items: string[] = [];
  let r: i32 = w.next();
  while (r === PG_ARRAY_ELEMENT || r === PG_ARRAY_NULL) {
    items.push(r === PG_ARRAY_NULL ? "NULL" : `${w.int()}`);
    r = w.next();
  }
  const end: string = r === PG_ARRAY_END ? "end" : r === PG_ARRAY_BAD ? "bad" : "other";
  return `[${items.join(",")}] ${end}${p.failed ? " failed" : ""}`;
};

const binaryArrays = (t: Suite): void => {
  const p = new PgBinary();
  const w = new PgBinaryArray(p);
  t.eqStr("ndim 0: the empty array", walkArray(w, p, arrayOf(0, 0, 23, 0, [])), "[] end");
  t.eqI32("and it has no elements", w.count, 0);
  t.eqStr("one int4", walkArray(w, p, arrayOf(1, 0, 23, 1, [elem(toI64(7), 4)])), "[7] end");
  t.eqI32("its count", w.count, 1);
  t.eqI32("its element OID", w.elementOid, 23);
  t.eqStr("int2 elements", walkArray(w, p, arrayOf(1, 0, 21, 2, [elem(toI64(-2), 2), elem(toI64(32767), 2)])), "[-2,32767] end");
  t.eqStr("int8 elements, the most negative too", walkArray(w, p, arrayOf(1, 0, 20, 2, [elem(MIN_I64(), 8), elem(toI64(1), 8)])), "[-9223372036854775808,1] end");
  t.eqStr("a NULL with hasnull 1", walkArray(w, p, arrayOf(1, 1, 23, 3, [elem(toI64(1), 4), nullElem(), elem(toI64(-1), 4)])), "[1,NULL,-1] end");
  t.eqStr("a NULL with hasnull 0", walkArray(w, p, arrayOf(1, 0, 23, 2, [elem(toI64(1), 4), nullElem()])), "[1] bad failed");

  const many: u8[][] = [];
  for (let i: i32 = 0; i < 1000; i++) {
    many.push(elem(toI64(i), 4));
  }
  const big: u8[] = arrayOf(1, 0, 23, 1000, many);
  p.reset();
  w.begin(big, 0, toI32(big.length));
  let n: i32 = 0;
  let sum: i64 = toI64(0);
  while (w.next() === PG_ARRAY_ELEMENT) {
    sum += w.int();
    n += 1;
  }
  t.eqI32("1000 elements", n, 1000);
  t.eqI32("the count", w.count, 1000);
  t.ok("their sum", sum === toI64(499500) && !p.failed);
  t.eqI32("then the end, exactly", w.next(), PG_ARRAY_END);

  const nul: u8[] = arrayOf(1, 1, 23, 1, [nullElem()]);
  p.reset();
  w.begin(nul, 0, toI32(nul.length));
  t.eqI32("a NULL element", w.next(), PG_ARRAY_NULL);
  t.ok("its int fails", w.int() === toI64(0) && p.failed);

  // Malformed input: each refusal ends the walk, and sets binary.failed.
  t.eqStr("ndim 2", walkArray(w, p, arrayOf(2, 0, 23, 1, [elem(toI64(7), 4)])), "[] bad failed");
  t.eqStr("ndim -1", walkArray(w, p, arrayOf(-1, 0, 23, 0, [])), "[] bad failed");
  t.eqStr("another element type: text", walkArray(w, p, arrayOf(1, 0, 25, 1, [elem(toI64(7), 4)])), "[] bad failed");
  t.eqStr("a 3-byte int4 element", walkArray(w, p, arrayOf(1, 0, 23, 1, [elem(toI64(7), 3)])), "[] bad failed");
  t.eqStr("a 4-byte element in an int2 array", walkArray(w, p, arrayOf(1, 0, 21, 1, [elem(toI64(7), 4)])), "[] bad failed");
  t.eqStr("an int8 element of 4 bytes", walkArray(w, p, arrayOf(1, 0, 20, 1, [elem(toI64(7), 4)])), "[] bad failed");
  t.eqStr("a hasnull that is not 0 or 1", walkArray(w, p, arrayOf(1, 2, 23, 1, [elem(toI64(7), 4)])), "[] bad failed");
  t.eqStr("a negative dimension", walkArray(w, p, arrayOf(1, 0, 23, -1, [])), "[] bad failed");
  t.eqStr("more elements promised than given", walkArray(w, p, arrayOf(1, 0, 23, 2, [elem(toI64(7), 4)])), "[7] bad failed");
  t.eqStr("one element promised, two given", walkArray(w, p, arrayOf(1, 0, 23, 1, [elem(toI64(7), 4), elem(toI64(8), 4)])), "[7] bad failed");
  t.eqStr("bytes after an empty array", walkArray(w, p, arrayOf(0, 0, 23, 0, [elem(toI64(7), 4)])), "[] bad failed");
  const one: u8[] = arrayOf(1, 0, 23, 1, [elem(toI64(7), 4)]);
  t.eqStr("truncated inside the element", walkArray(w, p, slice(one, 0, one.length - 1)), "[] bad failed");
  t.eqStr("truncated inside the length word", walkArray(w, p, slice(one, 0, 21)), "[] bad failed");
  t.eqStr("truncated inside the header", walkArray(w, p, slice(one, 0, 15)), "[] bad failed");
  t.eqStr("an empty window", walkArray(w, p, slice(one, 0, 0)), "[] bad failed");
  p.reset();
  w.begin(one, 0, one.length + 1);
  t.eqI32("a window past the buffer", w.next(), PG_ARRAY_BAD);
  t.ok("it is failed", p.failed);
  p.reset();
  w.begin(one, -1, 4);
  t.eqI32("a window before it", w.next(), PG_ARRAY_BAD);
  t.ok("it is failed too", p.failed);
  p.reset();
  t.ok("int on a refused walk fails", w.int() === toI64(0) && p.failed);
};

export const main = (): number => {
  const t = new Suite("postgres");
  startup(t);
  framing(t);
  unexpected(t);
  malformed(t);
  auths(t);
  wipes(t);
  serverErrors(t);
  settings(t);
  lifecycle(t);
  builders(t);
  results(t);
  output(t);
  params(t);
  pipeline(t);
  ints(t);
  timestamps(t);
  arrays(t);
  intArrays(t);
  arrayBuilder(t);
  binaryBinds(t);
  binaryRows(t);
  binaryInts(t);
  binaryTimes(t);
  binaryArrays(t);
  return t.done();
};

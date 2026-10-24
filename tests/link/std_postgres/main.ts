// nish/net/postgres, function by function: what each builder writes, what
// each message does to the connection, and every way a server's answer, or a
// program's call, is refused. The exchanges with a real server are in
// std_postgres_replay; these are the frames no well-behaved server sends.
import {
  PgArrayWalker,
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
  PG_ERR_TOO_BIG,
  PG_ERR_UNEXPECTED,
  PG_FAILED,
  PG_GROUP_DONE,
  PG_NEED_MORE,
  PG_NOTICE,
  PG_READY,
  PG_ROW,
} from "nish/net/postgres";
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
  c.maxMessage = 100;
  const big: u8[] = [toU8(83)];
  pushI32(big, 101);
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
  t.eqStr("AuthenticationOk before the server proved the password", feed(skipped, auth(0, [])), scram);
  t.ok("a failed connection holds no password", skipped.failure === PG_ERR_SCRAM);
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

export const main = (): number => {
  const t = new Suite("postgres");
  startup(t);
  framing(t);
  unexpected(t);
  malformed(t);
  auths(t);
  serverErrors(t);
  lifecycle(t);
  builders(t);
  results(t);
  ints(t);
  timestamps(t);
  arrays(t);
  return t.done();
};

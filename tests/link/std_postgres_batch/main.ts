// nish/net/postgres's PgBatcher, offline: the statement it prepares, what
// `take` binds from the queue and when it takes fewer, how rows route by
// their ordinal to every request for a key, and every ordinal a server could
// send that names no key still open, and what a server or the network can
// send once a run is over, through a PgPool as a program would. The round trip with a real server is in
// tests/postgres/live (the `batch` scenario).
import {
  PgBatchConfig,
  PgBatcher,
  PgConfig,
  PgConnection,
  PgPool,
  PG_BATCH_DONE,
  PG_BATCH_FAILED,
  PG_BATCH_INT,
  PG_BATCH_MISSING,
  PG_BATCH_NONE,
  PG_BATCH_ROW,
  PG_BATCH_TEXT,
  PG_COMPLETE,
  PG_ERROR,
  PG_FAILED,
  PG_GROUP_DONE,
  PG_LOST,
  PG_NEED_MORE,
  PG_ROW,
} from "nish/net/postgres";
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

/** A DataRow of `values`, each `nulls[i]` written as a NULL column. */
const dataRow = (values: string[], nulls: boolean[]): u8[] => {
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

/** A row of the batch statement: the query's one column, then the ordinal. */
const row = (value: string, ordinal: string): u8[] => {
  return dataRow([value, ordinal], []);
};

/** The server's answer to a batch execution: BindComplete, `rows`, its tag, ReadyForQuery. */
const answer = (rows: u8[]): u8[] => {
  return cat(cat(cat(msg("2", []), rows), msg("C", z("SELECT 1|"))), msg("Z", z("I")));
};

/** The server's answer to a batch execution that fails after `rows`. */
const failure = (rows: u8[]): u8[] => {
  return cat(cat(cat(msg("2", []), rows), msg("E", z("SERROR|VERROR|C57014|Mcanceled||"))), msg("Z", z("I")));
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

/** The key array `take` bound, `{` to `}`; ends the group and marks it sent. */
const keys = (conn: PgConnection): string => {
  conn.sync();
  const text: string = drain(conn);
  const from: i32 = toI32(text.indexOf("{"));
  // The array ends where the Bind's result format count, two NULs, begins.
  const to: i32 = toI32(text.indexOf("}||"));
  return from < 0 || to < from ? `none in ${text}` : text.slice(from, to + 1);
};

const STARTUP_DONE = (): u8[] => {
  const key: u8[] = [];
  pushI32(key, 4242);
  pushI32(key, 7);
  const authOk: u8[] = [];
  pushI32(authOk, 0);
  return cat(cat(cat(msg("R", authOk), msg("S", z("client_encoding|UTF8|"))), msg("K", key)), msg("Z", z("I")));
};

/** A ready connection of `c` with `b.sql` prepared and answered. */
const prepared = (b: PgBatcher, c: PgConfig): PgConnection => {
  const password = secret(z("pw"));
  const conn = new PgConnection(c, password, z("nish-postgres-test"));
  wipe(password);
  drain(conn);
  route(b, -1, conn, STARTUP_DONE());
  const none: i32[] = [];
  conn.prepare(b.name, b.sql, none);
  conn.sync();
  drain(conn);
  route(b, -1, conn, cat(cat(msg("1", []), msg("t", z("||"))), msg("Z", z("I"))));
  return conn;
};

const config = (): PgConfig => {
  const c = new PgConfig();
  c.user = "app";
  c.database = "db";
  return c;
};

/** Run `r`'s events until `PG_BATCH_NONE`: `tag=value` a row, `tag.` done, `tag?` missing, `tag!` failed. */
const events = (b: PgBatcher, r: i32, conn: PgConnection, out: string[]): void => {
  while (true) {
    const e: i32 = b.next(r);
    if (e === PG_BATCH_NONE) {
      if (b.tag !== -1) {
        out.push("tag set on none");
      }
      return;
    }
    if (e === PG_BATCH_ROW) {
      out.push(`${b.tag}=${conn.columnText(0)}`);
    } else if (e === PG_BATCH_DONE) {
      out.push(`${b.tag}.`);
    } else if (e === PG_BATCH_MISSING) {
      out.push(`${b.tag}?`);
    } else if (e === PG_BATCH_FAILED) {
      out.push(`${b.tag}!`);
    } else {
      out.push(`event ${e}`);
    }
  }
};

/**
 * Feeds `bytes` to `conn`, run `r`'s answer: each row goes to `row` (`no`
 * when it answers false), the tag to `end` and an error to `fail`, each
 * followed by the events it owes. `r` -1 routes nothing.
 */
const route = (b: PgBatcher, r: i32, conn: PgConnection, bytes: u8[]): string => {
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
    } else if (r < 0) {
      continue;
    } else if (event === PG_ROW) {
      if (b.row(r, conn)) {
        events(b, r, conn, out);
      } else {
        out.push("no");
      }
    } else if (event === PG_COMPLETE) {
      b.end(r);
      events(b, r, conn, out);
    } else if (event === PG_ERROR) {
      b.fail(r);
      events(b, r, conn, out);
    }
  }
  return out.join(",");
};

/** A row of the batch statement in binary: the query's text column, then the ordinal as a binary int8. */
const binaryRow = (value: string, ordinal: i32): u8[] => {
  const body: u8[] = [];
  pushI16(body, 2);
  pushI32(body, toI32(value.length));
  for (const b of z(value)) {
    body.push(b);
  }
  pushI32(body, 8);
  pushI32(body, 0);
  pushI32(body, ordinal);
  return msg("D", body);
};

const ints = (): PgBatchConfig => {
  const c = new PgBatchConfig();
  c.name = "titles";
  c.select = "select title from articles where id = q.key";
  return c;
};

const texts = (): PgBatchConfig => {
  const c = new PgBatchConfig();
  c.name = "bySlug";
  c.select = "select title from articles where slug = q.key";
  c.keyType = PG_BATCH_TEXT;
  return c;
};

const statement = (t: Suite): void => {
  const b = new PgBatcher(ints());
  t.eqStr("the name", b.name, "titles");
  t.eqStr(
    "an int8 batch",
    b.sql,
    "select t.*, q.ord from unnest($1::int8[]) with ordinality as q(key, ord) cross join lateral (select title from articles where id = q.key) as t order by q.ord",
  );
  const c = texts();
  c.orderBy = "t.created desc";
  t.eqStr(
    "a text batch, its rows ordered within a key",
    new PgBatcher(c).sql,
    "select t.*, q.ord from unnest($1::text[]) with ordinality as q(key, ord) cross join lateral (select title from articles where slug = q.key) as t order by q.ord, t.created desc",
  );
};

const queueing = (t: Suite): void => {
  const c = ints();
  c.queueSize = 2;
  const b = new PgBatcher(c);
  const conn = prepared(b, config());
  t.eqI32("nothing waits", b.waiting(), 0);
  t.eqI32("so take has nothing to take", b.take(conn), -1);
  t.eqStr("and writes nothing", drain(conn), "");
  t.eqI32("nor opens a group", conn.inFlight, 0);
  t.ok("a request", b.addInt(toI64(5), 10));
  t.ok("another", b.addInt(toI64(6), 11));
  t.eqI32("two wait", b.waiting(), 2);
  t.ok("a third when queueSize are waiting is refused", !b.addInt(toI64(7), 12));
  t.eqI32("take answers a run", b.take(conn), 0);
  t.eqI32("and the queue is empty", b.waiting(), 0);
  t.eqStr("the keys, as the one parameter", keys(conn), "{5,6}");
  t.ok("and there is room again", b.addInt(toI64(7), 12));
};

const routing = (t: Suite): void => {
  const b = new PgBatcher(ints());
  const conn = prepared(b, config());
  b.addInt(toI64(5), 10);
  b.addInt(toI64(6), 11);
  b.addInt(toI64(5), 12);
  b.addInt(toI64(5), 13);
  const r: i32 = b.take(conn);
  t.eqI32("four requests, one run", r, 0);
  t.eqStr("each key once, in the order first asked", keys(conn), "{5,6}");
  t.eqI32("the group is in flight", conn.inFlight, 1);
  t.eqStr(
    "every row goes to every request for its key; the key no row answered is missing",
    route(b, r, conn, answer(cat(row("a", "1"), row("b", "1")))),
    "10=a,12=a,13=a,10=b,12=b,13=b,10.,12.,13.,11?",
  );
  t.eqI32("next on a run that is over", b.next(r), PG_BATCH_NONE);
  t.eqI32("names no request", b.tag, -1);
  t.eqI32("nothing in flight", conn.inFlight, 0);

  b.addInt(toI64(1), 1);
  b.addInt(toI64(2), 2);
  b.addInt(toI64(3), 3);
  const again: i32 = b.take(conn);
  t.eqI32("the run is free again, under its next handle: a use of 16 runs on", again, 16);
  keys(conn);
  t.eqStr(
    "a row for a later key closes those before it",
    route(b, again, conn, answer(cat(row("x", "2"), row("y", "2")))),
    "1?,2=x,2=y,2.,3?",
  );
  t.eqI32("nothing refused", b.refused, 0);

  // 1 and 2^31 fold to the same hash: the table tells them apart.
  b.addInt(toI64(1), 1);
  b.addInt(toI64(2147483647) + toI64(1), 2);
  b.addInt(toI64(1), 3);
  const clash: i32 = b.take(conn);
  t.eqStr("keys that share a hash stay apart", keys(conn), "{1,2147483648}");
  t.eqStr("and route apart", route(b, clash, conn, answer(cat(row("p", "1"), row("q", "2")))), "1=p,3=p,1.,3.,2=q,2.");

  const min: i64 = (toI64(-922337203) * toI64(1000000000) - toI64(685477580)) * toI64(10) - toI64(8);
  b.addInt(min, 1);
  b.addInt(toI64(0), 2);
  const extremes: i32 = b.take(conn);
  t.eqStr("the widest int8 keys", keys(conn), "{-9223372036854775808,0}");
  t.eqStr("no rows at all", route(b, extremes, conn, answer([])), "1?,2?");
};

const caps = (t: Suite): void => {
  const c = ints();
  c.maxRequests = 3;
  const b = new PgBatcher(c);
  const conn = prepared(b, config());
  for (let i: i32 = 0; i < 5; i++) {
    b.addInt(toI64(100 + i), i);
  }
  const r: i32 = b.take(conn);
  t.eqStr("maxRequests caps a take", keys(conn), "{100,101,102}");
  t.eqI32("the rest wait", b.waiting(), 2);
  t.eqStr("routed", route(b, r, conn, answer(row("a", "3"))), "0?,1?,2=a,2.");
  const s: i32 = b.take(conn);
  t.eqStr("the next take starts where it stopped", keys(conn), "{103,104}");
  route(b, s, conn, answer([]));

  for (let i: i32 = 0; i < 4; i++) {
    b.addInt(toI64(7), i);
  }
  const d: i32 = b.take(conn);
  t.eqStr("maxRequests counts requests, not keys", keys(conn), "{7}");
  t.eqI32("so one of four waits", b.waiting(), 1);
  t.eqStr("the three taken", route(b, d, conn, answer(row("a", "1"))), "0=a,1=a,2=a,0.,1.,2.");
  const e: i32 = b.take(conn);
  keys(conn);
  t.eqStr("the fourth", route(b, e, conn, answer(row("a", "1"))), "3=a,3.");

  const bc = ints();
  bc.maxBytes = 23;
  const small = new PgBatcher(bc);
  const sc: PgConnection = prepared(small, config());
  small.addInt(toI64(1000000000), 1);
  small.addInt(toI64(1000000001), 2);
  small.addInt(toI64(1000000000), 3);
  small.addInt(toI64(1000000002), 4);
  small.addInt(toI64(1000000001), 5);
  const f: i32 = small.take(sc);
  t.eqStr("maxBytes caps a take: {, two keys of ten, a comma and } is 23", keys(sc), "{1000000000,1000000001}");
  t.eqI32("a key already bound costs nothing; the take stops at the first that does not fit", small.waiting(), 2);
  t.eqStr("routed", route(small, f, sc, answer(row("a", "2"))), "1?,3?,2=a,2.");
  const g: i32 = small.take(sc);
  t.eqStr("those after it wait for the next take", keys(sc), "{1000000002,1000000001}");
  route(small, g, sc, answer([]));
  bc.maxBytes = 22;
  const short = new PgBatcher(bc);
  const shc: PgConnection = prepared(short, config());
  short.addInt(toI64(1000000000), 1);
  short.addInt(toI64(1000000001), 2);
  short.take(shc);
  t.eqStr("one byte short, the second key waits", keys(shc), "{1000000000}");
  t.eqI32("for the next take", short.waiting(), 1);
};

const textKeys = (t: Suite): void => {
  const b = new PgBatcher(texts());
  const conn = prepared(b, config());
  t.ok("a slice of a buffer", b.addText(z("<a\"b\\c>"), 1, 5, 1));
  t.ok("an empty key", b.addText(z("x"), 1, 0, 2));
  t.ok("the same key again", b.addText(z("a\"b\\c"), 0, 5, 3));
  // "bwfgaa" and "zidhaa" are distinct keys of one length whose 31-bit
  // FNV-1a hashes are equal, so only their bytes tell them apart; found by
  // hashing six-letter lowercase strings, in counting order, until two matched.
  t.ok("bwfgaa", b.addText(z("bwfgaa"), 0, 6, 4));
  t.ok("zidhaa, whose hash is bwfgaa's", b.addText(z("zidhaa"), 0, 6, 5));
  t.ok("bwfgaa again", b.addText(z("bwfgaa"), 0, 6, 6));
  const r: i32 = b.take(conn);
  t.eqStr("text keys quoted and escaped, each once", keys(conn), "{\"a\\\"b\\\\c\",\"\",\"bwfgaa\",\"zidhaa\"}");
  t.eqStr(
    "and routed",
    route(b, r, conn, answer(cat(cat(row("one", "1"), row("two", "2")), row("three", "4")))),
    "1=one,3=one,1.,3.,2=two,2.,4?,6?,5=three,5.",
  );

  const c = texts();
  c.maxBytes = 22;
  const tight = new PgBatcher(c);
  t.ok("a key that can never fit maxBytes is refused", !tight.addText(z("0123456789012345678"), 0, 19, 1));
  t.ok("one byte less fits", tight.addText(z("0123456789012345678"), 0, 18, 1));
  t.ok("a key whose escapes would pass maxBytes is refused", !tight.addText(z("01234567890123456\""), 0, 18, 2));
  t.ok("a key whose escapes just fit is not", tight.addText(z("0123456789012345\""), 0, 17, 3));
  t.ok("nor one whose backslash just fits", tight.addText(z("0123456789012345\\"), 0, 17, 4));
  t.eqI32("only the ones that fit wait", tight.waiting(), 3);

  // The server refuses a text value with a NUL or that is not UTF-8, which would fail every request taken with it.
  const nul: u8[] = [toU8(97), toU8(0), toU8(98)];
  t.ok("a key with a NUL is refused", !b.addText(nul, 0, 3, 1));
  t.ok("the bytes around it are not", b.addText(nul, 2, 1, 1));
  t.ok("a two-byte character", b.addText([toU8(0xc3), toU8(0xa9)], 0, 2, 1));
  t.ok("the widest character, U+10FFFF", b.addText([toU8(0xf4), toU8(0x8f), toU8(0xbf), toU8(0xbf)], 0, 4, 1));
  t.ok("a lone continuation byte is refused", !b.addText([toU8(0x80)], 0, 1, 1));
  t.ok("an overlong NUL is refused", !b.addText([toU8(0xc0), toU8(0x80)], 0, 2, 1));
  t.ok("an overlong three-byte form is refused", !b.addText([toU8(0xe0), toU8(0x9f), toU8(0xbf)], 0, 3, 1));
  t.ok("a surrogate is refused", !b.addText([toU8(0xed), toU8(0xa0), toU8(0x80)], 0, 3, 1));
  t.ok("past U+10FFFF is refused", !b.addText([toU8(0xf4), toU8(0x90), toU8(0x80), toU8(0x80)], 0, 4, 1));
  t.ok("a character cut by the window is refused", !b.addText([toU8(0xc3), toU8(0xa9)], 0, 1, 1));
  t.ok("a bad second continuation byte is refused", !b.addText([toU8(0xe2), toU8(0x82), toU8(0x41)], 0, 3, 1));
  t.eqI32("only the good ones wait", b.waiting(), 3);

  const ec = texts();
  ec.maxBytes = 22;
  const escaped = new PgBatcher(ec);
  const ecn: PgConnection = prepared(escaped, config());
  escaped.addText(z("aaaaaaa\""), 0, 8, 1);
  escaped.addText(z("bbbbb\""), 0, 6, 2);
  const er: i32 = escaped.take(ecn);
  t.eqStr("a take counts escapes: {, keys of eleven and nine, a comma and } is 23", keys(ecn), "{\"aaaaaaa\\\"\"}");
  t.eqI32("so the second waits", escaped.waiting(), 1);
  route(escaped, er, ecn, answer([]));
  const fit = new PgBatcher(ec);
  const fcn: PgConnection = prepared(fit, config());
  fit.addText(z("aaaaaaa\""), 0, 8, 1);
  fit.addText(z("bbbb\\"), 0, 5, 2);
  const fr: i32 = fit.take(fcn);
  t.eqStr("keys of eleven and eight with escapes fit maxBytes exactly: 22", keys(fcn), "{\"aaaaaaa\\\"\",\"bbbb\\\\\"}");
  t.eqI32("so none waits", fit.waiting(), 0);
  route(fit, fr, fcn, answer([]));
};

const store = (t: Suite): void => {
  const c = texts();
  c.queueBytes = 8;
  c.maxRequests = 1;
  const b = new PgBatcher(c);
  const conn = prepared(b, config());
  t.ok("four bytes", b.addText(z("abcd"), 0, 4, 1));
  t.ok("eight", b.addText(z("efgh"), 0, 4, 2));
  t.ok("a ninth would pass queueBytes", !b.addText(z("i"), 0, 1, 3));
  const r: i32 = b.take(conn);
  t.eqStr("the oldest taken", keys(conn), "{\"abcd\"}");
  t.ok("its room is reused: the waiting key moves to the front", b.addText(z("ijkl"), 0, 4, 3));
  t.eqStr("the taken key's run still routes", route(b, r, conn, answer(row("x", "1"))), "1=x,1.");
  const s: i32 = b.take(conn);
  t.eqStr("the moved key", keys(conn), "{\"efgh\"}");
  route(b, s, conn, answer([]));
  b.take(conn);
  t.eqStr("the key added after the move", keys(conn), "{\"ijkl\"}");
  t.ok("an empty queue has all its room", b.addText(z("mnopqrst"), 0, 8, 4));
};

const runs = (t: Suite): void => {
  const c = ints();
  c.runs = 2;
  c.maxRequests = 1;
  const b = new PgBatcher(c);
  const conn = prepared(b, config());
  for (let i: i32 = 1; i <= 3; i++) {
    b.addInt(toI64(i), i);
  }
  const r: i32 = b.take(conn);
  keys(conn);
  const s: i32 = b.take(conn);
  keys(conn);
  t.eqI32("two runs in flight", r * 10 + s, 1);
  t.eqI32("a third take while both are in flight", b.take(conn), -1);
  t.eqStr("writes nothing", drain(conn), "");
  t.eqI32("and leaves the request waiting", b.waiting(), 1);
  t.eqStr("the first answer", route(b, r, conn, answer(row("a", "1"))), "1=a,1.");
  const reused: i32 = b.take(conn);
  t.eqI32("frees its run, under a new handle", reused, 2);
  t.eqStr("for the waiting request", keys(conn), "{3}");
  t.eqStr("answers come in the order the runs were sent", route(b, s, conn, answer(row("b", "1"))), "2=b,2.");
  t.eqStr("the reused run sees only its own requests", route(b, reused, conn, answer(row("c", "1"))), "3=c,3.");

  b.addInt(toI64(5), 50);
  const u: i32 = b.take(conn);
  keys(conn);
  t.eqStr("an ordinal past a run's one key", route(b, u, conn, answer(row("stale", "2"))), "no,50!");
  t.eqI32("refused", b.refused, 1);

  // The run's first batch has three keys and its second one, so ordinal 3 is valid only for the first.
  const wc = ints();
  wc.runs = 1;
  wc.maxRequests = 3;
  const w = new PgBatcher(wc);
  const wcn: PgConnection = prepared(w, config());
  for (let i: i32 = 1; i <= 3; i++) {
    w.addInt(toI64(i), i);
  }
  const wide: i32 = w.take(wcn);
  t.eqStr("a run of three keys", keys(wcn), "{1,2,3}");
  t.eqStr("routes ordinal 3", route(w, wide, wcn, answer(row("c", "3"))), "1?,2?,3=c,3.");
  w.addInt(toI64(4), 40);
  const narrow: i32 = w.take(wcn);
  t.eqStr("the run again, with one key", keys(wcn), "{4}");
  t.eqStr("a later batch cannot read an earlier one's ordinals", route(w, narrow, wcn, answer(row("stale", "3"))), "no,40!");
  t.eqI32("refused", w.refused, 1);
};

/** Routes an answer of `bad`, then a good row, to a fresh run of keys 1 and 2. */
const refusal = (bad: u8[]): string => {
  const b = new PgBatcher(ints());
  const conn = prepared(b, config());
  b.addInt(toI64(1), 1);
  b.addInt(toI64(2), 2);
  const r: i32 = b.take(conn);
  keys(conn);
  const got: string = route(b, r, conn, answer(cat(bad, row("good", "2"))));
  return `${got} refused ${b.refused}`;
};

const ordinals = (t: Suite): void => {
  t.eqStr("an ordinal past the keys", refusal(row("x", "3")), "no,no,1!,2! refused 1");
  t.eqStr("ordinal 0", refusal(row("x", "0")), "no,no,1!,2! refused 1");
  t.eqStr("a negative ordinal", refusal(row("x", "-1")), "no,no,1!,2! refused 1");
  t.eqStr("a NULL ordinal", refusal(dataRow(["x", ""], [false, true])), "no,no,1!,2! refused 1");
  t.eqStr("an ordinal that is not an integer", refusal(row("x", "1x")), "no,no,1!,2! refused 1");
  t.eqStr("an ordinal past an int8", refusal(row("x", "99999999999999999999")), "no,no,1!,2! refused 1");
  t.eqStr("a row of no columns", refusal(dataRow([], [])), "no,no,1!,2! refused 1");
  t.eqStr("an ordinal that goes back", refusal(cat(row("x", "2"), row("y", "1"))), "1?,2=x,no,no,2! refused 1");
  t.eqStr("the key the last row named may come again", refusal(row("x", "2")), "1?,2=x,2=good,2. refused 0");

  const b = new PgBatcher(ints());
  const conn = prepared(b, config());
  b.addInt(toI64(1), 1);
  const r: i32 = b.take(conn);
  keys(conn);
  conn.text.failed = true;
  route(b, r, conn, answer(row("a", "1")));
  t.ok("reading a good ordinal keeps the program's text.failed", conn.text.failed);
  conn.text.reset();
  b.addInt(toI64(1), 1);
  const s: i32 = b.take(conn);
  keys(conn);
  route(b, s, conn, answer(row("a", "x")));
  t.ok("and a bad one does not set it", !conn.text.failed);
};

const failures = (t: Suite): void => {
  const b = new PgBatcher(ints());
  const conn = prepared(b, config());
  for (let i: i32 = 1; i <= 3; i++) {
    b.addInt(toI64(i), i);
  }
  b.addInt(toI64(1), 4);
  const r: i32 = b.take(conn);
  keys(conn);
  t.eqStr(
    "an error after rows fails every request not yet closed",
    route(b, r, conn, failure(cat(row("a", "1"), row("b", "2")))),
    "1=a,4=a,1.,4.,2=b,2!,3!",
  );
  t.eqI32("an error is not a refusal", b.refused, 0);
  b.addInt(toI64(1), 1);
  const s: i32 = b.take(conn);
  keys(conn);
  t.eqStr("an error before any row", route(b, s, conn, failure([])), "1!");
  b.addInt(toI64(1), 1);
  const u: i32 = b.take(conn);
  t.eqI32("frees the run for the next take", u % 16, 0);
  keys(conn);
  b.fail(u);
  const out: string[] = [];
  events(b, u, conn, out);
  t.eqStr("a lost connection fails the run as an error does", out.join(","), "1!");
  t.eqI32("none of it was stray", b.stray, 0);
};

/**
 * Feeds `bytes` to the pool's slot `s`, run `r`'s answer, as the guide's loop
 * does: a row to `row`, the tag to `end`, an error or a lost request to `fail`,
 * each followed by its events, and `group` for the group's end.
 */
const poolRoute = (b: PgBatcher, r: i32, p: PgPool, s: i32, bytes: u8[]): string => {
  const out: string[] = [];
  const conn: PgConnection = p.connection(s);
  let fed: i32 = 0;
  while (true) {
    fed += conn.receive(bytes, fed, toI32(bytes.length) - fed);
    const event: i32 = p.next(s);
    if (event === PG_NEED_MORE) {
      if (fed === toI32(bytes.length)) {
        break;
      }
    } else if (event === PG_FAILED) {
      out.push("failed");
      break;
    } else if (event === PG_ROW) {
      if (b.row(r, conn)) {
        events(b, r, conn, out);
      } else {
        out.push("no");
      }
    } else if (event === PG_COMPLETE) {
      b.end(r);
      events(b, r, conn, out);
    } else if (event === PG_ERROR || event === PG_LOST) {
      b.fail(r);
      events(b, r, conn, out);
    } else if (event === PG_GROUP_DONE) {
      out.push("group");
    }
  }
  return out.join(",");
};

/** A pool of one connection with the batch statement registered, keys 1 and 2 taken on it and sent; then `bytes`, its answer, with what was stray. */
const pooled = (bytes: u8[], lose: boolean): string => {
  const b = new PgBatcher(ints());
  const none: i32[] = [];
  const password = secret(z("pw"));
  const p = new PgPool(config(), password, 1, 8);
  wipe(password);
  p.register(b.name, b.sql, none);
  p.request();
  // No connection yet: the first dispatch asks for one.
  p.dispatch();
  const s: i32 = p.wanted();
  p.connect(s, z("nish-postgres-test"));
  drain(p.connection(s));
  poolRoute(b, -1, p, s, STARTUP_DONE());
  p.dispatch();
  b.addInt(toI64(1), 1);
  b.addInt(toI64(2), 2);
  const r: i32 = b.take(p.connection(s));
  p.send();
  drain(p.connection(s));
  // The pool's own Describe of the registered statement: ParseComplete, no parameters, NoData.
  const described: u8[] = cat(cat(msg("1", []), msg("t", [toU8(0), toU8(0)])), msg("n", []));
  let got: string = poolRoute(b, r, p, s, cat(described, bytes));
  if (lose) {
    p.connection(s).closed();
    got = `${got};${poolRoute(b, r, p, s, [])}`;
  }
  return `${got} stray ${b.stray} refused ${b.refused}`;
};

const strays = (t: Suite): void => {
  const bind: u8[] = msg("2", []);
  const tag: u8[] = msg("C", z("SELECT 1|"));
  const ready: u8[] = msg("Z", z("I"));
  const error: u8[] = msg("E", z("SERROR|VERROR|C40001|Mcould not serialize||"));
  t.eqStr("an answer as it should be", pooled(cat(cat(cat(bind, row("a", "1")), tag), ready), false), "1=a,1.,2?,group stray 0 refused 0");
  t.eqStr("a second CommandComplete is stray", pooled(cat(cat(cat(cat(bind, row("a", "1")), tag), tag), ready), false), "1=a,1.,2?,group stray 1 refused 0");
  t.eqStr("a row after CommandComplete is stray", pooled(cat(cat(cat(bind, tag), row("a", "1")), ready), false), "1?,2?,no,group stray 1 refused 0");
  t.eqStr("an error after CommandComplete, as a commit at Sync can fail, is stray", pooled(cat(cat(cat(bind, tag), error), ready), false), "1?,2?,group stray 1 refused 0");
  t.eqStr("a connection lost after CommandComplete, before the group is done", pooled(cat(bind, tag), true), "1?,2?;failed stray 1 refused 0");
  t.eqStr("a row after an error is stray", pooled(cat(cat(cat(bind, error), row("a", "1")), ready), false), "1!,2!,no,group stray 1 refused 0");
  t.eqStr("a CommandComplete after an error is stray", pooled(cat(cat(cat(bind, error), tag), ready), false), "1!,2!,group stray 1 refused 0");

  const c = ints();
  c.runs = 1;
  const b = new PgBatcher(c);
  const conn = prepared(b, config());
  b.addInt(toI64(1), 1);
  const r: i32 = b.take(conn);
  keys(conn);
  route(b, r, conn, answer([]));
  b.addInt(toI64(2), 2);
  const s: i32 = b.take(conn);
  keys(conn);
  t.ok("the one run is taken again under a new handle", s !== r);
  b.end(r);
  b.fail(r);
  t.ok("a row on the spent handle answers false", !b.row(r, conn));
  t.eqI32("and next on it answers nothing", b.next(r), PG_BATCH_NONE);
  t.eqI32("each counted stray", b.stray, 3);
  t.eqStr("the new execution is untouched", route(b, s, conn, answer(row("x", "1"))), "2=x,2.");
};

/** A take of one key of `length` bytes by a batcher of `maxBytes`, named bySlug, on a connection of maxOutput 1024: its array's start and length, or -1. */
const fullTake = (maxBytes: i32, length: i32): string => {
  const c = texts();
  c.maxBytes = maxBytes;
  const b = new PgBatcher(c);
  const pc = config();
  pc.maxOutput = 1024;
  const conn = prepared(b, pc);
  const key: u8[] = new Array<u8>(length);
  for (let i: i32 = 0; i < length; i++) {
    key[i] = toU8(98);
  }
  b.addText(key, 0, length, 1);
  if (b.take(conn) < 0) {
    return "-1";
  }
  const got: string = keys(conn);
  return `${got.slice(0, 5)}${got.slice(toI32(got.length) - 3)} of ${got.length}`;
};

const room = (t: Suite): void => {
  const c = texts();
  c.maxBytes = 4096;
  const b = new PgBatcher(c);
  const pc = config();
  pc.maxOutput = 1024;
  pc.maxInFlight = 1;
  const conn = prepared(b, pc);
  const big: u8[] = new Array<u8>(1100);
  for (let i: i32 = 0; i < 1100; i++) {
    big[i] = toU8(98);
  }
  t.ok("a key", b.addText(z("a"), 0, 1, 1));
  t.ok("a key larger than the connection's maxOutput", b.addText(big, 0, 1100, 2));
  const r: i32 = b.take(conn);
  t.eqStr("a key with no room is left for a later take", keys(conn), "{\"a\"}");
  t.eqI32("so it waits", b.waiting(), 1);
  b.addText(z("c"), 0, 1, 3);
  t.eqI32("a take while maxInFlight groups are in flight", b.take(conn), -1);
  t.eqStr("writes nothing", drain(conn), "");
  t.eqI32("and opens no group", conn.inFlight, 1);
  t.eqStr("routed", route(b, r, conn, answer(row("x", "1"))), "1=x,1.");
  t.eqI32("a take whose first key has no room", b.take(conn), -1);
  t.eqStr("cancels its bind and writes nothing", drain(conn), "");
  t.eqI32("so no group is open", conn.inFlight, 0);
  t.eqI32("both still wait", b.waiting(), 2);
  const types: i32[] = [];
  t.ok("the connection still works", conn.prepare("other", "select 1", types) && conn.sync());
  // maxBytes + name.length + 32 <= maxOutput: the Bind's head of 11 and the
  // name, the array's length word of 4, and the 17 kept for the tail.
  t.eqStr("a full take fits maxOutput at the bound", fullTake(986, 982), "{\"bbbb\"} of 986");
  t.eqStr("and a byte past it is refused", fullTake(987, 983), "-1");
};

/** A binary batch's answer to `bad` then a good row, and what it refused. */
const binaryRefusal = (bad: u8[]): string => {
  const c = ints();
  c.binary = true;
  const b = new PgBatcher(c);
  const conn = prepared(b, config());
  b.addInt(toI64(1), 1);
  b.addInt(toI64(2), 2);
  const r: i32 = b.take(conn);
  conn.sync();
  drain(conn);
  const got: string = route(b, r, conn, answer(cat(bad, binaryRow("good", 2))));
  return `${got} refused ${b.refused}`;
};

const binaryBatch = (t: Suite): void => {
  const c = ints();
  c.binary = true;
  const b = new PgBatcher(c);
  const conn = prepared(b, config());
  b.addInt(toI64(5), 10);
  b.addInt(toI64(6), 11);
  const r: i32 = b.take(conn);
  t.eqI32("a binary take answers a run", r, 0);
  conn.sync();
  const bind: string = drain(conn);
  t.ok("its Bind asks for one result format, binary", bind.indexOf("}|<1>|<1>") >= 0 && bind.indexOf("}||") < 0);
  t.eqStr(
    "its ordinals are read as binary int8s, each row to its request",
    route(b, r, conn, answer(cat(binaryRow("x", 1), binaryRow("y", 2)))),
    "10=x,10.,11=y,11.",
  );
  t.eqI32("nothing refused", b.refused, 0);

  // The caller's own binary decode state is left as it was.
  const again: i32 = b.take(conn);
  conn.sync();
  drain(conn);
  conn.binary.failed = true;
  route(b, again, conn, answer(cat(binaryRow("z", 1), binaryRow("w", 2))));
  t.ok("binary.failed stays as the caller set it", conn.binary.failed);

  t.eqStr("a text ordinal is refused", binaryRefusal(row("text", "1")), "no,no,1!,2! refused 1");
  t.eqStr("a NULL ordinal is refused", binaryRefusal(dataRow(["x", "0"], [false, true])), "no,no,1!,2! refused 1");
};

export const main = (): number => {
  const t = new Suite("postgres batch");
  statement(t);
  queueing(t);
  routing(t);
  caps(t);
  textKeys(t);
  store(t);
  runs(t);
  ordinals(t);
  failures(t);
  strays(t);
  room(t);
  binaryBatch(t);
  return t.done();
};

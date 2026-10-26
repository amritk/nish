// nish/net/postgres's PgBatcher, offline: the statement it prepares, what
// `take` binds from the queue and when it takes fewer, how rows route by
// their ordinal to every request for a key, and every ordinal a server could
// send that names no key still open. The round trip with a real server is in
// tests/postgres/live (the `batch` scenario).
import {
  PgBatchConfig,
  PgBatcher,
  PgConfig,
  PgConnection,
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
  t.eqI32("the run is free again", again, 0);
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
  t.eqStr("maxBytes caps a take: {, two keys of ten, a comma and }", keys(sc), "{1000000000,1000000001}");
  t.eqI32("a key already bound costs nothing; the take stops at the first that does not fit", small.waiting(), 2);
  t.eqStr("routed", route(small, f, sc, answer(row("a", "2"))), "1?,3?,2=a,2.");
  small.take(sc);
  t.eqStr("those after it wait for the next take", keys(sc), "{1000000002,1000000001}");
};

const textKeys = (t: Suite): void => {
  const b = new PgBatcher(texts());
  const conn = prepared(b, config());
  t.ok("a slice of a buffer", b.addText(z("<a\"b\\c>"), 1, 5, 1));
  t.ok("an empty key", b.addText(z("x"), 1, 0, 2));
  t.ok("the same key again", b.addText(z("a\"b\\c"), 0, 5, 3));
  // "Aa" and "BB" share a hash.
  t.ok("Aa", b.addText(z("Aa"), 0, 2, 4));
  t.ok("BB", b.addText(z("BB"), 0, 2, 5));
  t.ok("Aa again", b.addText(z("Aa"), 0, 2, 6));
  const r: i32 = b.take(conn);
  t.eqStr("text keys quoted and escaped, each once", keys(conn), "{\"a\\\"b\\\\c\",\"\",\"Aa\",\"BB\"}");
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
  t.eqI32("only the one that fits waits", tight.waiting(), 1);
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
  t.eqI32("frees its run", b.take(conn), 0);
  t.eqStr("for the waiting request", keys(conn), "{3}");
  t.eqStr("answers come in the order the runs were sent", route(b, s, conn, answer(row("b", "1"))), "2=b,2.");
  t.eqStr("the reused run sees only its own requests", route(b, 0, conn, answer(row("c", "1"))), "3=c,3.");

  b.addInt(toI64(5), 50);
  const u: i32 = b.take(conn);
  keys(conn);
  t.eqStr(
    "a later batch cannot read an earlier one's ordinals",
    route(b, u, conn, answer(row("stale", "2"))),
    "no,50!",
  );
  t.eqI32("refused", b.refused, 1);
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
  t.eqI32("frees the run for the next take", b.take(conn), 0);
  keys(conn);
  b.fail(0);
  const out: string[] = [];
  events(b, 0, conn, out);
  t.eqStr("a lost connection fails the run as an error does", out.join(","), "1!");
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
  room(t);
  return t.done();
};

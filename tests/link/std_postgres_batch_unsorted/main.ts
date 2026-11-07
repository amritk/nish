// nish/net/postgres's PgBatcher with `sorted` false, offline: the statement
// it prepares, rows routed by ordinal in whatever order they come, every
// last event held until the execution ends, a run that fails after rows,
// every ordinal a server could send that names no key of the run, and what
// a server or the network can send once a run is over. The sorted batcher
// is tests/link/std_postgres_batch; the round trip with a real server is in
// tests/postgres/live (the `batch` and `explain` scenarios).
import {
  PgBatchConfig,
  PgBatcher,
  PgConfig,
  PgConnection,
  PgPool,
  PG_BATCH_DONE,
  PG_BATCH_FAILED,
  PG_BATCH_MISSING,
  PG_BATCH_NONE,
  PG_BATCH_ROW,
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
  const b = new PgBatcher(unsorted());
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
const ints = (): PgBatchConfig => {
  const c = new PgBatchConfig();
  c.name = "titles";
  c.select = "select title from articles where id = q.key";
  return c;
};

const unsorted = (): PgBatchConfig => {
  const c = ints();
  c.sorted = false;
  return c;
};

const statement = (t: Suite): void => {
  const lateral: string =
    "select t.*, q.ord from unnest($1::int8[]) with ordinality as q(key, ord) cross join lateral (select title from articles where id = q.key) as t";
  t.eqStr("sorted by default", new PgBatcher(ints()).sql, `${lateral} order by q.ord`);
  t.eqStr("unsorted: no order by at all", new PgBatcher(unsorted()).sql, lateral);
  const c = unsorted();
  c.orderBy = "t.created desc";
  t.eqStr("unsorted with orderBy: ordered by it alone", new PgBatcher(c).sql, `${lateral} order by t.created desc`);
  const s = ints();
  s.orderBy = "t.created desc";
  t.eqStr("sorted with orderBy, as before", new PgBatcher(s).sql, `${lateral} order by q.ord, t.created desc`);
};

const interleaved = (t: Suite): void => {
  const b = new PgBatcher(unsorted());
  const conn = prepared(b, config());
  b.addInt(toI64(5), 10);
  b.addInt(toI64(6), 11);
  b.addInt(toI64(5), 12);
  b.addInt(toI64(7), 13);
  const r: i32 = b.take(conn);
  t.eqStr("each key once", keys(conn), "{5,6,7}");
  const rows: u8[] = cat(cat(cat(cat(row("a", "2"), row("b", "1")), row("c", "3")), row("d", "1")), row("e", "2"));
  t.eqStr(
    "rows of ordinals 2, 1, 3, 1, 2: each to every request for its key, at once, and no last event",
    route(b, r, conn, cat(msg("2", []), rows)),
    "11=a,10=b,12=b,13=c,10=d,12=d,11=e",
  );
  t.eqI32("the run waits for its end", b.next(r), PG_BATCH_NONE);
  t.eqStr(
    "the end gives every request one last event, in key order then request order",
    route(b, r, conn, cat(msg("C", z("SELECT 5|")), msg("Z", z("I")))),
    "10.,12.,11.,13.",
  );
  t.eqI32("next on a run that is over", b.next(r), PG_BATCH_NONE);
  t.eqI32("names no request", b.tag, -1);
  t.eqI32("nothing in flight", conn.inFlight, 0);
  t.eqI32("nothing refused", b.refused, 0);

  b.addInt(toI64(1), 1);
  b.addInt(toI64(2), 2);
  b.addInt(toI64(3), 3);
  const again: i32 = b.take(conn);
  t.eqI32("the run is free again, under its next handle", again, 16);
  keys(conn);
  t.eqStr(
    "a key with no row is missing, and only at the end",
    route(b, again, conn, answer(cat(row("x", "3"), row("y", "1")))),
    "3=x,1=y,1.,2?,3.",
  );
  b.addInt(toI64(1), 1);
  b.addInt(toI64(2), 2);
  const none: i32 = b.take(conn);
  keys(conn);
  t.eqStr("no rows at all", route(b, none, conn, answer([])), "1?,2?");
};

const failures = (t: Suite): void => {
  const b = new PgBatcher(unsorted());
  const conn = prepared(b, config());
  for (let i: i32 = 1; i <= 3; i++) {
    b.addInt(toI64(i), i);
  }
  b.addInt(toI64(1), 4);
  const r: i32 = b.take(conn);
  keys(conn);
  t.eqStr(
    "an error after rows of two keys fails every request once, those with rows too",
    route(b, r, conn, failure(cat(row("a", "2"), row("b", "1")))),
    "2=a,1=b,4=b,1!,4!,2!,3!",
  );
  t.eqI32("an error is not a refusal", b.refused, 0);
  b.addInt(toI64(1), 1);
  b.addInt(toI64(2), 2);
  const s: i32 = b.take(conn);
  keys(conn);
  const rows: string = route(b, s, conn, cat(msg("2", []), row("a", "2")));
  b.fail(s);
  const out: string[] = [];
  events(b, s, conn, out);
  t.eqStr("a lost connection after a row fails the run as an error does", `${rows};${out.join(",")}`, "2=a;1!,2!");
  t.eqI32("none of it was stray", b.stray, 0);
};

/** Routes an answer of `bad`, then a good row, to a fresh unsorted run of keys 1 and 2. */
const refusal = (bad: u8[]): string => {
  const b = new PgBatcher(unsorted());
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
  t.eqStr(
    "a bad ordinal after rows fails those keys' requests too",
    refusal(cat(row("x", "1"), row("y", "3"))),
    "1=x,no,no,1!,2! refused 1",
  );
  t.eqStr(
    "an ordinal that goes back is accepted",
    refusal(cat(row("x", "2"), row("y", "1"))),
    "2=x,1=y,2=good,1.,2. refused 0",
  );
  t.eqStr("a key's ordinal may come again", refusal(row("x", "2")), "2=x,2=good,1?,2. refused 0");

  const b = new PgBatcher(unsorted());
  const conn = prepared(b, config());
  b.addInt(toI64(1), 1);
  const r: i32 = b.take(conn);
  keys(conn);
  route(b, r, conn, answer(row("a", "x")));
  t.ok("a bad ordinal does not set the program's text.failed", !conn.text.failed);
};

const strays = (t: Suite): void => {
  const bind: u8[] = msg("2", []);
  const tag: u8[] = msg("C", z("SELECT 1|"));
  const ready: u8[] = msg("Z", z("I"));
  const error: u8[] = msg("E", z("SERROR|VERROR|C40001|Mcould not serialize||"));
  t.eqStr("an answer as it should be", pooled(cat(cat(cat(bind, row("a", "2")), tag), ready), false), "2=a,1?,2.,group stray 0 refused 0");
  t.eqStr("a second CommandComplete is stray", pooled(cat(cat(cat(cat(bind, row("a", "1")), tag), tag), ready), false), "1=a,1.,2?,group stray 1 refused 0");
  t.eqStr("a row after CommandComplete is stray", pooled(cat(cat(cat(bind, tag), row("a", "1")), ready), false), "1?,2?,no,group stray 1 refused 0");
  t.eqStr("an error after CommandComplete is stray", pooled(cat(cat(cat(bind, tag), error), ready), false), "1?,2?,group stray 1 refused 0");
  t.eqStr("a connection lost after CommandComplete", pooled(cat(bind, tag), true), "1?,2?;failed stray 1 refused 0");
  t.eqStr("a connection lost after a row, before CommandComplete", pooled(cat(bind, row("a", "2")), true), "2=a;1!,2!,failed stray 0 refused 0");
  t.eqStr("a row after an error is stray", pooled(cat(cat(cat(bind, error), row("a", "1")), ready), false), "1!,2!,no,group stray 1 refused 0");

  const c = unsorted();
  c.runs = 1;
  const b = new PgBatcher(c);
  const conn = prepared(b, config());
  b.addInt(toI64(1), 1);
  b.addInt(toI64(2), 2);
  const r: i32 = b.take(conn);
  keys(conn);
  t.eqStr("a run whose keys both had rows", route(b, r, conn, answer(cat(row("a", "2"), row("b", "1")))), "2=a,1=b,1.,2.");
  b.addInt(toI64(3), 3);
  b.addInt(toI64(4), 4);
  const s: i32 = b.take(conn);
  keys(conn);
  t.ok("the one run is taken again under a new handle", s !== r);
  b.end(r);
  b.fail(r);
  t.ok("a row on the spent handle answers false", !b.row(r, conn));
  t.eqI32("and next on it answers nothing", b.next(r), PG_BATCH_NONE);
  t.eqI32("each counted stray", b.stray, 3);
  t.eqStr("the reused run sees none of the old run's rows", route(b, s, conn, answer(row("x", "2"))), "4=x,3?,4.");
};

export const main = (): number => {
  const t = new Suite("postgres batch unsorted");
  statement(t);
  interleaved(t);
  failures(t);
  ordinals(t);
  strays(t);
  return t.done();
};

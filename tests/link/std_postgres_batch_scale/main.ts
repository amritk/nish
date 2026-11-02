// nish/net/postgres's PgBatcher past 1024 requests, offline: keys chosen to
// share one hash cost each request at most 1024 probes, the key whose probe
// stops is bound again under its own ordinal and routed there, and a
// batcher's arrays grow with the batches it takes, up to its cap, and are
// reused by later, smaller ones. The live round trip at each size is
// tests/postgres/live's `batchscale` scenario.
import {
  PgBatchConfig,
  PgBatcher,
  PgConfig,
  PgConnection,
  PG_BATCH_DONE,
  PG_BATCH_FAILED,
  PG_BATCH_MISSING,
  PG_BATCH_NONE,
  PG_BATCH_ROW,
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

const ints = (most: i32): PgBatchConfig => {
  const c = new PgBatchConfig();
  c.name = "titles";
  c.select = "select title from articles where id = q.key";
  c.maxRequests = most;
  c.maxBytes = 1048576;
  c.queueSize = 70000;
  return c;
};

/** The int8 key `j * 2^31 + j`: its two 31-bit halves are equal, so every such key folds to hash 0. */
const colliding = (j: i32): i64 => {
  return (toI64(j) << toI64(31)) + toI64(j);
};

/** The elements of an array `{...}`, by its commas. */
const count = (array: string): i32 => {
  if (array === "{}") {
    return 0;
  }
  let n: i32 = 1;
  for (let i: i32 = 0; i < toI32(array.length); i++) {
    if (toI32(array.charCodeAt(i)) === 44) {
      n += 1;
    }
  }
  return n;
};

/** `route`'s events, each missing request counted rather than listed. */
const brief = (events: string): string => {
  const kept: string[] = [];
  let missing: i32 = 0;
  let from: i32 = 0;
  while (from <= toI32(events.length)) {
    let to: i32 = toI32(events.indexOf(",", from));
    if (to < 0) {
      to = toI32(events.length);
    }
    const e: string = events.slice(from, to);
    if (e.endsWith("?")) {
      missing += 1;
    } else {
      kept.push(e);
    }
    from = to + 1;
  }
  return `${kept.join(",")} and ${missing} missing`;
};

const collisions = (t: Suite): void => {
  const b = new PgBatcher(ints(2048));
  const conn = prepared(b, config());
  // 1024 keys of one hash, then the last again: its probe passes the other 1023 and finds it.
  for (let j: i32 = 0; j < 1024; j++) {
    b.addInt(colliding(j), j);
  }
  b.addInt(colliding(1023), 1024);
  const r: i32 = b.take(conn);
  t.eqI32("1025 requests of one hash, one run", r, 0);
  t.eqI32("1024 keys of one hash are each found: none is bound twice", count(keys(conn)), 1024);
  t.eqStr(
    "the last key's two requests share its rows",
    brief(route(b, r, conn, answer(row("last", "1024")))),
    "1023=last,1024=last,1023.,1024. and 1023 missing",
  );

  // 1100 keys of one hash: from the 1025th on, a probe stops after 1024 slots.
  for (let j: i32 = 0; j < 1100; j++) {
    b.addInt(colliding(j), j);
  }
  b.addInt(colliding(5), 1100);
  b.addInt(colliding(1050), 1101);
  const again: i32 = b.take(conn);
  const array: string = keys(conn);
  t.eqI32("1102 requests, one execution", b.waiting(), 0);
  t.eqI32("a key in the table is found, one past it is bound again", count(array), 1101);
  t.ok("the key bound again is the last element", array.endsWith(`,${colliding(1099)},${colliding(1050)}}`));
  t.eqStr(
    "each copy routes by its own ordinal, to its own request",
    brief(route(b, again, conn, answer(cat(cat(row("five", "6"), row("first", "1051")), row("second", "1101"))))),
    "5=five,1100=five,5.,1100.,1050=first,1050.,1101=second,1101. and 1098 missing",
  );
  t.eqI32("nothing refused", b.refused, 0);

  // A failed execution of 1100 colliding keys fails every request once.
  for (let j: i32 = 0; j < 1100; j++) {
    b.addInt(colliding(j), j);
  }
  const lost: i32 = b.take(conn);
  keys(conn);
  const failed: string = route(b, lost, conn, failure(row("only", "1")));
  t.ok("a failed run of 1100 keys answers each request PG_BATCH_FAILED", failed.startsWith("0=only,0!,1!,2!") && failed.endsWith(",1098!,1099!"));
  b.addInt(toI64(1), 0);
  t.ok("and the next take answers a run", b.take(conn) >= 0);
};

const growth = (t: Suite): void => {
  const c = ints(65536);
  c.runs = 1;
  const b = new PgBatcher(c);
  const conn = prepared(b, config());
  b.addInt(toI64(7), 0);
  const one: i32 = b.take(conn);
  t.eqStr("a batch of one", keys(conn), "{7}");
  t.eqStr("routes", route(b, one, conn, answer(row("seven", "1"))), "0=seven,0.");

  for (let i: i32 = 0; i < 40; i++) {
    b.addInt(toI64(i % 20), i);
  }
  const forty: i32 = b.take(conn);
  t.eqI32("forty requests, the one run under its next handle", forty, 1);
  t.eqI32("twenty keys, the arrays grown past their first size", count(keys(conn)), 20);
  t.eqStr("each key's two requests share its rows", brief(route(b, forty, conn, answer(row("nineteen", "20")))), "19=nineteen,39=nineteen,19.,39. and 38 missing");

  for (let i: i32 = 0; i < 65537; i++) {
    b.addInt(toI64(i), i);
  }
  const full: i32 = b.take(conn);
  t.eqI32("65537 waiting: one execution takes 65536", b.waiting(), 1);
  const array: string = keys(conn);
  t.eqI32("each key once", count(array), 65536);
  t.ok("from 0 to 65535", array.startsWith("{0,1,2,") && array.endsWith(",65534,65535}"));
  t.eqStr(
    "the first and last route",
    brief(route(b, full, conn, answer(cat(row("first", "1"), row("last", "65536"))))),
    "0=first,0.,65535=last,65535. and 65534 missing",
  );

  b.addInt(toI64(3), 1);
  b.addInt(toI64(3), 2);
  const small: i32 = b.take(conn);
  t.eqStr("a small batch after it reuses the grown arrays", keys(conn), "{65536,3}");
  t.eqStr("and routes", route(b, small, conn, answer(row("three", "2"))), "65536?,1=three,2=three,1.,2.");
};

export const main = (): number => {
  const t = new Suite("postgres batch scale");
  collisions(t);
  growth(t);
  return t.done();
};

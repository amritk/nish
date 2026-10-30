// nish/net/postgres's PgBatchClock and PgBatchTurns, offline: the defaults
// are the fixed window; each reason a batch starts (count, average, timer,
// idle); the moving average and how a backlog keeps it; the clock through
// PgBatcher.takeDue and PgPool.inFlight; and turn-taking that wakes the
// collector once per batch, not once per item. bench/pg-batch-clock.ts
// measures the policy under load.
import {
  PgBatchClock,
  PgBatchClockConfig,
  PgBatchConfig,
  PgBatchTurns,
  PgBatcher,
  PgConfig,
  PgConnection,
  PgPool,
  PG_CLOCK_AVERAGE,
  PG_CLOCK_COUNT,
  PG_CLOCK_IDLE,
  PG_CLOCK_TIMER,
  PG_CLOCK_WAIT,
  PG_FAILED,
  PG_NEED_MORE,
  PG_TURNS_FULL,
  PG_TURNS_NONE,
} from "nish/net/postgres";
import { secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";

const us = (n: i32): i64 => toI64(n);

/** `n` arrivals at `at`. */
const arrive = (c: PgBatchClock, n: i32, at: i64): void => {
  for (let i: i32 = 0; i < n; i++) {
    c.arrived(at);
  }
};

/** An adaptive clock: start at 4, or the average times 1.5, capped at 16. */
const adaptive = (): PgBatchClockConfig => {
  const c = new PgBatchClockConfig();
  c.maxCount = 16;
  c.minCount = 4;
  c.factor = 1.5;
  c.weight = 0.5;
  c.maxWaitUs = us(1000);
  c.queueSize = 64;
  return c;
};

const fixedWindow = (t: Suite): void => {
  const c = new PgBatchClock(new PgBatchClockConfig());
  t.eqI32("the default target is maxCount", c.target(), 32);
  t.eqI64("nothing waits, no deadline", c.deadline(), toI64(-1));
  t.eqI32("nothing waits, nothing is due", c.check(us(0), 0), PG_CLOCK_WAIT);
  arrive(c, 31, us(100));
  t.eqI64("the deadline is the oldest plus maxWaitUs", c.deadline(), us(10100));
  t.eqI32("31 is short of the count", c.check(us(10099), 0), PG_CLOCK_WAIT);
  t.eqI32("so the timer starts it", c.check(us(10100), 0), PG_CLOCK_TIMER);
  c.started(31, us(10100));
  t.eqI32("the last reason", c.lastReason, PG_CLOCK_TIMER);
  t.eqI64("the oldest's wait", c.lastWaitUs, us(10000));
  arrive(c, 32, us(20000));
  t.eqI32("32 starts by count at once", c.check(us(20000), 3), PG_CLOCK_COUNT);
  c.started(32, us(20000));
  t.eqI32("idle never bypasses by default", c.check(us(20000), 0), PG_CLOCK_WAIT);
  arrive(c, 1, us(30000));
  t.eqI32("however quiet", c.check(us(30001), 0), PG_CLOCK_WAIT);
  t.eqI32("the target does not move", c.target(), 32);
  t.eqI64("one start by the timer", c.startsFor(PG_CLOCK_TIMER), toI64(1));
  t.eqI64("one by count", c.startsFor(PG_CLOCK_COUNT), toI64(1));
};

const average = (t: Suite): void => {
  const c = new PgBatchClock(adaptive());
  t.eqI32("before a batch, minCount", c.target(), 4);
  arrive(c, 12, us(0));
  t.eqI32("4 or more start by count", c.check(us(0), 1), PG_CLOCK_COUNT);
  c.started(12, us(0));
  t.eqF64("the first batch sets the average", c.average, toF64(12));
  t.eqI32("the average times 1.5, capped at maxCount", c.target(), 16);
  arrive(c, 15, us(10));
  t.eqI32("15 is short of 16", c.check(us(10), 1), PG_CLOCK_WAIT);
  arrive(c, 1, us(20));
  t.eqI32("16 starts by the average", c.check(us(20), 1), PG_CLOCK_AVERAGE);
  c.started(16, us(20));
  t.eqF64("the average moves halfway", c.average, toF64(14));
  t.eqI32("last size", c.lastSize, 16);
  t.eqI32("last reason", c.lastReason, PG_CLOCK_AVERAGE);

  // The load falls: the timer starts small batches and the target follows them down.
  arrive(c, 2, us(100));
  t.eqI32("two are not due", c.check(us(1099), 1), PG_CLOCK_WAIT);
  t.eqI32("until the timer", c.check(us(1100), 1), PG_CLOCK_TIMER);
  c.started(2, us(1100));
  t.eqF64("the average falls", c.average, toF64(8));
  t.eqI32("so does the target", c.target(), 12);
  arrive(c, 2, us(2000));
  c.check(us(3000), 1);
  c.started(2, us(3000));
  t.eqF64("and falls", c.average, toF64(5));
  t.eqI32("the target rounds up", c.target(), 8);
  for (let i: i32 = 0; i < 3; i++) {
    arrive(c, 2, us(4000 + 2000 * i));
    c.check(us(5000 + 2000 * i), 1);
    c.started(2, us(5000 + 2000 * i));
  }
  t.eqF64("the average nears the batches", c.average, toF64(19) / toF64(8));
  t.eqI32("the target never falls below minCount", c.target(), 4);
};

const backlog = (t: Suite): void => {
  const c = new PgBatchClock(adaptive());
  arrive(c, 16, us(0));
  c.check(us(0), 4);
  c.started(16, us(0));
  // Every connection is busy and 40 pile up, long past the timer.
  arrive(c, 40, us(100));
  for (let i: i32 = 0; i < 2; i++) {
    t.eqI32(`a backlog starts by the average ${i}`, c.check(us(5000), 4), PG_CLOCK_AVERAGE);
    c.started(16, us(5000));
  }
  t.eqF64("full batches keep the average", c.average, toF64(16));
  t.eqI32("8 left is short of the target", c.check(us(5000), 4), PG_CLOCK_TIMER);
  t.eqI64("the timer started none of the backlog", c.startsFor(PG_CLOCK_TIMER), toI64(0));
  t.eqI64("two by the average", c.startsFor(PG_CLOCK_AVERAGE), toI64(2));
  t.eqI64("and the first by count", c.startsFor(PG_CLOCK_COUNT), toI64(1));
};

const idle = (t: Suite): void => {
  const cfg = adaptive();
  cfg.lightCount = 3;
  cfg.lightWindowUs = us(1000);
  const c = new PgBatchClock(cfg);
  arrive(c, 1, us(0));
  t.eqI32("a lone item with nothing in flight goes at once", c.check(us(0), 0), PG_CLOCK_IDLE);
  t.eqI32("not with a batch in flight", c.check(us(0), 1), PG_CLOCK_WAIT);
  c.check(us(0), 0);
  c.started(1, us(0));
  t.eqI32("the reason is recorded", c.lastReason, PG_CLOCK_IDLE);
  arrive(c, 2, us(10));
  t.eqI32("three in the window is not light", c.check(us(10), 0), PG_CLOCK_WAIT);
  t.eqI32("once the first leaves the window it is", c.check(us(1000), 0), PG_CLOCK_IDLE);
};

const time = (t: Suite): void => {
  const cfg = adaptive();
  cfg.queueSize = 2;
  const c = new PgBatchClock(cfg);
  t.ok("an arrival", c.arrived(us(500)));
  t.ok("one that steps back counts as the last", c.arrived(us(100)));
  t.ok("a third is refused when queueSize wait", !c.arrived(us(600)));
  t.eqI32("two wait", c.waiting(), 2);
  c.started(1, us(400));
  t.eqI64("a start before the arrival waited 0", c.lastWaitUs, toI64(0));
  t.eqI64("the stepped-back one sits at 500", c.deadline(), us(1500));
  const zero = adaptive();
  zero.maxWaitUs = us(0);
  const z = new PgBatchClock(zero);
  z.arrived(us(7));
  t.eqI32("a zero wait is due at once", z.check(us(7), 1), PG_CLOCK_TIMER);
};

/** A ready connection of `c` with `b.sql` prepared. */
const prepared = (b: PgBatcher, c: PgConfig): PgConnection => {
  const password = secret(z("pw"));
  const conn = new PgConnection(c, password, z("nish-postgres-test"));
  wipe(password);
  conn.sent(conn.outputEnd() - conn.outputStart());
  feed(conn, STARTUP_DONE());
  const none: i32[] = [];
  conn.prepare(b.name, b.sql, none);
  conn.sync();
  conn.sent(conn.outputEnd() - conn.outputStart());
  feed(conn, cat(cat(msg("1", []), msg("t", z("||"))), msg("Z", z("I"))));
  return conn;
};

const batcher = (t: Suite): void => {
  const bc = new PgBatchConfig();
  bc.name = "titles";
  bc.select = "select title from articles where id = q.key";
  bc.maxRequests = 8;
  const b = new PgBatcher(bc);
  const cfg = adaptive();
  cfg.maxCount = 8;
  const clock = new PgBatchClock(cfg);
  const conn = prepared(b, config());
  for (let i: i32 = 0; i < 3; i++) {
    b.addInt(toI64(i), i);
    clock.arrived(us(0));
  }
  t.eqI32("three are short of the count", b.takeDue(conn, clock, us(10), 1), -1);
  t.eqI32("so nothing is bound", conn.outputEnd() - conn.outputStart(), 0);
  b.addInt(toI64(3), 3);
  clock.arrived(us(20));
  t.eqI32("four take a run", b.takeDue(conn, clock, us(30), 1), 0);
  t.eqI32("all four taken", b.waiting(), 0);
  t.eqI32("the clock saw four", clock.lastSize, 4);
  t.eqI32("by count", clock.lastReason, PG_CLOCK_COUNT);
  t.eqI32("and mirrors the batcher", clock.waiting(), 0);

  const password = secret(z("pw"));
  const pool = new PgPool(config(), password, 2, 4);
  wipe(password);
  t.eqI32("a new pool has nothing in flight", pool.inFlight(), 0);
  pool.dispose();
};

const turns = (t: Suite): void => {
  const tr = new PgBatchTurns(new PgBatchClock(adaptive()), 2);
  t.eqI32("the collector is slot 0", tr.collector(), 0);
  t.eqI32("an item is not due", tr.push(us(0)), PG_TURNS_NONE);
  t.eqI32("nor a second", tr.push(us(1)), PG_TURNS_NONE);
  t.eqI32("nor a third", tr.push(us(2)), PG_TURNS_NONE);
  t.eqI32("the fourth wakes the collector", tr.push(us(3)), 0);
  t.eqI32("the fifth wakes no one again", tr.push(us(4)), PG_TURNS_NONE);
  t.eqI32("starting all five names no one", tr.started(0, 5, us(5)), PG_TURNS_NONE);
  t.eqI32("slot 1 collects", tr.collector(), 1);
  t.eqI32("one in flight", tr.inFlight(), 1);
  arrive(tr.clock, 8, us(10));
  t.eqI32("eight are due: wake slot 1", tr.poll(us(10)), 1);
  t.eqI32("slot 1 starts, none collects", tr.started(1, 8, us(10)), PG_TURNS_NONE);
  t.eqI32("so a due push wakes no one", tr.push(us(20)), PG_TURNS_NONE);
  arrive(tr.clock, 7, us(20));
  t.eqI32("eight, short of ten, wait on the timer", tr.finished(0, us(30)), PG_TURNS_NONE);
  t.eqI32("which wakes the free slot", tr.poll(us(1020)), 0);
  tr.release(0);
  t.eqI32("a wake given back can be named again", tr.poll(us(1020)), 0);
  t.eqI64("the deadline is the clock's", tr.deadline(), tr.clock.deadline());

  const full = adaptive();
  full.queueSize = 1;
  const small = new PgBatchTurns(new PgBatchClock(full), 1);
  small.push(us(0));
  t.eqI32("a full clock refuses a push", small.push(us(1)), PG_TURNS_FULL);
};

export const main = (): number => {
  const t = new Suite("postgres batch clock");
  fixedWindow(t);
  average(t);
  backlog(t);
  idle(t);
  time(t);
  batcher(t);
  turns(t);
  return t.done();
};

// --- The wire, as tests/link/std_postgres_batch writes it ---------------------

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

const STARTUP_DONE = (): u8[] => {
  const key: u8[] = [];
  pushI32(key, 4242);
  pushI32(key, 7);
  const authOk: u8[] = [];
  pushI32(authOk, 0);
  return cat(cat(cat(msg("R", authOk), msg("S", z("client_encoding|UTF8|"))), msg("K", key)), msg("Z", z("I")));
};

/** Feeds `bytes` and reads every event they hold. */
const feed = (conn: PgConnection, bytes: u8[]): void => {
  let fed: i32 = 0;
  while (true) {
    fed += conn.receive(bytes, fed, toI32(bytes.length) - fed);
    const event: i32 = conn.next();
    if (event === PG_FAILED || (event === PG_NEED_MORE && fed === toI32(bytes.length))) {
      return;
    }
  }
};

const config = (): PgConfig => {
  const c = new PgConfig();
  c.user = "app";
  c.database = "db";
  return c;
};

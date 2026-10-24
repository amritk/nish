// nish/net/postgres's PgPool, function by function, against frames written
// here: which slot a request goes to, when a connection is wanted, how a
// registered statement leads a connection's first group, and what a failed
// connection reports. tests/postgres/live runs it against a server.
import {
  PgConfig,
  PgPool,
  PG_COMPLETE,
  PG_ERROR,
  PG_ERR_CLOSED,
  PG_ERR_NONE,
  PG_FAILED,
  PG_GROUP_DONE,
  PG_LOST,
  PG_NEED_MORE,
  PG_NOTICE,
  PG_POOL_FULL,
  PG_POOL_NONE,
  PG_READY,
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

const none = (): i32[] => {
  const out: i32[] = [];
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

/** AuthenticationOk, BackendKeyData, ReadyForQuery. */
const STARTUP_DONE = (): u8[] => {
  const ok: u8[] = [];
  pushI32(ok, 0);
  const key: u8[] = [];
  pushI32(key, 4242);
  pushI32(key, 7);
  return cat(cat(msg("R", ok), msg("K", key)), msg("Z", z("I")));
};

/** A prepare's answer: ParseComplete, no parameters, NoData. */
const DESCRIBED = (): u8[] => {
  return cat(cat(msg("1", []), msg("t", [toU8(0), toU8(0)])), msg("n", []));
};

/** A bound statement's answer: BindComplete, then its tag. */
const DONE = (): u8[] => {
  return cat(msg("2", []), msg("C", z("SELECT 0|")));
};

const IDLE = (): u8[] => {
  return msg("Z", z("I"));
};

const ERROR = (code: string): u8[] => {
  return msg("E", z(`SERROR|VERROR|C${code}|Mno||`));
};

const config = (): PgConfig => {
  const c = new PgConfig();
  c.user = "app";
  c.database = "db";
  return c;
};

const pool = (c: PgConfig, size: i32, queueSize: i32): PgPool => {
  const password = secret(z("pw"));
  const p = new PgPool(c, password, size, queueSize);
  wipe(password);
  return p;
};

/** Connects the wanted slot, drops its startup message, and answers it ready; the slot. */
const up = (p: PgPool): i32 => {
  const s: i32 = p.wanted();
  if (s < 0) {
    return s;
  }
  p.connect(s, z("nish-postgres-test"));
  drain(p, s);
  feed(p, s, STARTUP_DONE());
  return s;
};

/** Feeds `bytes` to `slot`, then reads to the end: each event and its ticket, `event@ticket`. */
const feed = (p: PgPool, slot: i32, bytes: u8[]): string => {
  const events: string[] = [];
  let fed: i32 = 0;
  while (true) {
    fed += p.connection(slot).receive(bytes, fed, toI32(bytes.length) - fed);
    const event: i32 = p.next(slot);
    if (event === PG_NEED_MORE) {
      if (fed === toI32(bytes.length)) {
        break;
      }
    } else {
      events.push(`${event}@${p.ticket}`);
      if (event === PG_FAILED) {
        break;
      }
    }
  }
  return events.join(",");
};

/** The message types `slot` has queued, and marks them sent. */
const drain = (p: PgPool, slot: i32): string => {
  const conn = p.connection(slot);
  const out: u8[] = conn.outputBuffer();
  const types: string[] = [];
  let at: i32 = conn.outputStart();
  while (at >= 0 && at + 4 < conn.outputEnd() && at + 4 < toI32(out.length)) {
    const length: i32 = (toI32(out[at + 1]) << 24) | (toI32(out[at + 2]) << 16) | (toI32(out[at + 3]) << 8) | toI32(out[at + 4]);
    types.push(String.fromCharCode(toI32(out[at])));
    at += 1 + length;
  }
  conn.sent(conn.outputEnd() - conn.outputStart());
  return types.join("");
};

/** Dispatches the next request and sends it as one bound `name`; its slot, or `PG_POOL_NONE`. */
const run = (p: PgPool, name: string): i32 => {
  const s: i32 = p.dispatch();
  if (s >= 0) {
    const conn = p.connection(s);
    conn.bindStart(name);
    conn.bindEnd();
    p.send();
  }
  return s;
};

const construct = (t: Suite): void => {
  const p = pool(config(), 4, 8);
  t.eqI32("its size", p.size, 4);
  t.eqI32("no slot is wanted at start-up", p.wanted(), PG_POOL_NONE);
  t.eqI32("nothing waits", p.waiting(), 0);
  t.ok("the pool holds its copy of the password", !p.passwordWiped());
  const one = pool(config(), 1, 1);
  t.eqI32("a pool of one, with a queue of one", one.request(), 0);
};

const registers = (t: Suite): void => {
  const p = pool(config(), 1, 4);
  t.ok("a statement registers", p.register("q", "select 1", none()));
  t.ok("a NUL in a name is refused", !p.register(String.fromCharCode(0), "select 1", none()));
  t.ok("a NUL in SQL is refused", !p.register("r", `select ${String.fromCharCode(0)}`, none()));
  p.request();
  p.dispatch();
  up(p);
  t.ok("once a connection is made, none may register", !p.register("r", "select 2", none()));
  const full = pool(config(), 1, 1);
  const types: i32[] = none();
  for (let i: i32 = 0; i < 256; i++) {
    full.register(`s${i}`, "select 1", types);
  }
  t.ok("256 register; the 257th is refused", !full.register("s256", "select 1", none()));
};

const requests = (t: Suite): void => {
  const p = pool(config(), 1, 3);
  t.eqI32("the first ticket", p.request(), 0);
  t.eqI32("the second", p.request(), 1);
  t.eqI32("the third", p.request(), 2);
  t.eqI32("a full queue refuses", p.request(), PG_POOL_FULL);
  t.eqI32("and holds what it had", p.waiting(), 3);
};

const dispatches = (t: Suite): void => {
  const p = pool(config(), 2, 64);
  t.eqI32("nothing waits: no slot", p.dispatch(), PG_POOL_NONE);
  t.eqI32("and none is wanted", p.wanted(), PG_POOL_NONE);
  p.request();
  t.eqI32("no connection yet: no slot", p.dispatch(), PG_POOL_NONE);
  t.eqI32("but the first is wanted", p.wanted(), 0);
  t.eqI32("asked again, still only the first", p.dispatch() === PG_POOL_NONE ? p.wanted() : -9, 0);
  p.connect(0, z("nish-postgres-test"));
  t.ok("its startup message waits to be sent", p.connection(0).outputEnd() > 0);
  p.connection(0).sent(p.connection(0).outputEnd());
  t.eqI32("starting, it takes no request", p.dispatch(), PG_POOL_NONE);
  t.eqI32("and no other slot is wanted for one request", p.wanted(), PG_POOL_NONE);
  t.eqStr("it is ready", feed(p, 0, STARTUP_DONE()), `${PG_READY}@-1`);
  t.eqI32("the request goes to it", p.dispatch(), 0);
  t.eqI32("its ticket", p.ticket, 0);
  t.eqI32("it no longer waits", p.waiting(), 0);
  p.request();
  t.eqI32("while one is being built, no other is handed out", p.dispatch(), PG_POOL_NONE);
  p.connection(0).bindStart("");
  p.connection(0).bindEnd();
  t.ok("sent", p.send());
  t.eqStr("as Bind, Execute, Sync", drain(p, 0), "BES");
  t.eqI32("the next goes to the same slot: the other has no connection", run(p, ""), 0);
  t.eqI32("two in flight on it", p.connection(0).inFlight, 2);
  t.eqI32("the pool makes no second connection while the first has room", p.wanted(), PG_POOL_NONE);

  // 16 in flight on slot 0, the default maxInFlight: the next must wait.
  for (let i: i32 = 2; i < 16; i++) {
    p.request();
    run(p, "");
  }
  t.eqI32("16 in flight", p.connection(0).inFlight, 16);
  const ticket: i32 = p.request();
  t.eqI32("a full connection takes no more", p.dispatch(), PG_POOL_NONE);
  t.eqI32("so the second slot is wanted", p.wanted(), 1);
  up(p);
  t.eqI32("the waiting request goes to the new one", run(p, ""), 1);
  t.eqI32("in FIFO order", p.ticket, ticket);
  p.request();
  t.eqI32("the next to the one with fewer in flight", run(p, ""), 1);
  drain(p, 0);
  drain(p, 1);
  t.eqStr(
    "the first group done frees slot 0 a place",
    feed(p, 0, cat(DONE(), IDLE())),
    `${PG_COMPLETE}@0,${PG_GROUP_DONE}@0`,
  );
  t.eqStr("the next answer is the second request's", feed(p, 0, DONE()), `${PG_COMPLETE}@1`);
};

const sends = (t: Suite): void => {
  const p = pool(config(), 1, 8);
  t.ok("nothing dispatched: nothing to send", !p.send());
  p.request();
  p.dispatch();
  const s: i32 = up(p);
  t.eqI32("dispatched", p.dispatch(), s);
  const conn = p.connection(s);
  conn.bindStart("");
  t.ok("a bind still open is not sent", !p.send());
  conn.bindEnd();
  t.ok("finished, it is", p.send());
  t.ok("and not twice", !p.send());
  drain(p, s);
  p.request();
  p.dispatch();
  t.ok("a request with nothing written is dropped", !p.send());
  t.eqI32("so a request after it is handed out", p.request() >= 0 ? p.dispatch() : -9, s);
  p.connection(s).bindStart("");
  p.connection(s).bindEnd();
  p.send();
  t.eqStr(
    "and the answers are the sent requests', in order",
    feed(p, s, cat(cat(DONE(), IDLE()), cat(DONE(), IDLE()))),
    `${PG_COMPLETE}@0,${PG_GROUP_DONE}@0,${PG_COMPLETE}@2,${PG_GROUP_DONE}@2`,
  );
};

const connects = (t: Suite): void => {
  const p = pool(config(), 1, 8);
  p.request();
  p.dispatch();
  p.connect(0, z("nish-postgres-test"));
  t.ok("the connection is made", p.connection(0).canSend() === false);
  t.eqI32("and wanted no longer", p.wanted(), PG_POOL_NONE);
  t.ok("it holds its own copy of the password", !p.connection(0).passwordWiped());
};

const statements = (t: Suite): void => {
  const p = pool(config(), 1, 8);
  p.register("a", "select 1", none());
  p.register("b", "select 2", none());
  p.request();
  p.dispatch();
  const s: i32 = up(p);
  run(p, "a");
  t.eqStr("the first group prepares both, then binds", drain(p, s), "PDPDBES");
  p.request();
  run(p, "b");
  t.eqStr("the second only binds", drain(p, s), "BES");
  t.eqStr(
    "the pool's own Describe answers are not reported",
    feed(p, s, cat(cat(cat(DESCRIBED(), DESCRIBED()), DONE()), IDLE())),
    `${PG_COMPLETE}@0,${PG_GROUP_DONE}@0`,
  );

  const bad = pool(config(), 1, 8);
  bad.register("a", "select 1", none());
  bad.register("b", "select nope", none());
  bad.request();
  bad.dispatch();
  const b: i32 = up(bad);
  run(bad, "b");
  drain(bad, b);
  t.eqStr(
    "a registered statement the server refuses fails the request it led",
    feed(bad, b, cat(cat(DESCRIBED(), ERROR("42703")), IDLE())),
    `${PG_ERROR}@0,${PG_GROUP_DONE}@0`,
  );
  bad.request();
  run(bad, "b");
  t.eqStr("and the next request prepares it again, not the one before it", drain(bad, b), "PDBES");
};

const failures = (t: Suite): void => {
  const p = pool(config(), 1, 8);
  p.request();
  p.dispatch();
  const s: i32 = up(p);
  run(p, "");
  p.request();
  run(p, "");
  drain(p, s);
  t.eqStr("a notice is the request's in flight", feed(p, s, msg("N", z("SNOTICE|C01000|Mw||"))), `${PG_NOTICE}@0`);
  p.connection(s).closed();
  t.eqStr(
    "a connection that fails loses each request it took, oldest first",
    feed(p, s, []),
    `${PG_LOST}@0,${PG_LOST}@1,${PG_FAILED}@-1`,
  );
  t.eqI32("the cause stays on its connection", p.connection(s).failure, PG_ERR_CLOSED);
  t.eqI32("it answers PG_FAILED after", p.next(s), PG_FAILED);
  const ticket: i32 = p.request();
  t.eqI32("the next request finds no connection", p.dispatch(), PG_POOL_NONE);
  t.eqI32("so the slot is wanted again", p.wanted(), s);
  up(p);
  t.eqI32("and rebuilt", p.connection(s).failure, PG_ERR_NONE);
  t.eqI32("the request goes to it", run(p, ""), s);
  t.eqI32("the waiting ticket", p.ticket, ticket);

  const down = pool(config(), 1, 8);
  down.request();
  down.request();
  down.dispatch();
  down.connect(0, z("nish-postgres-test"));
  down.connection(0).closed();
  t.eqStr(
    "a connection that fails starting, none ready, takes the oldest request with it",
    feed(down, 0, []),
    `${PG_LOST}@0,${PG_FAILED}@-1`,
  );
  t.eqI32("one is left", down.waiting(), 1);

  const building = pool(config(), 1, 8);
  building.request();
  building.dispatch();
  up(building);
  building.dispatch();
  building.connection(0).closed();
  t.eqStr(
    "a request being built when its connection fails is lost",
    feed(building, 0, []),
    `${PG_LOST}@0,${PG_FAILED}@-1`,
  );
  t.ok("and need not be sent", !building.send());
};

const disposes = (t: Suite): void => {
  const p = pool(config(), 2, 8);
  p.request();
  p.dispatch();
  const s: i32 = p.wanted();
  p.connect(s, z("nish-postgres-test"));
  p.dispose();
  t.ok("dispose wipes the pool's password", p.passwordWiped());
  t.ok("and its connections'", p.connection(s).passwordWiped());
  p.dispose();
  t.ok("and may be called twice", p.passwordWiped());
};

export const main = (): number => {
  const t = new Suite("postgres pool");
  construct(t);
  registers(t);
  requests(t);
  dispatches(t);
  sends(t);
  connects(t);
  statements(t);
  failures(t);
  disposes(t);
  return t.done();
};

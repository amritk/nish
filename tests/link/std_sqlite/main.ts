// `nish/sqlite` end to end: every call of the module, each once where it
// succeeds and once where it fails, and the failure's code and message, on an
// in-memory database; a file database in WAL mode; one statement reused 1,000
// times; and 100,000 rows read with the arena flat. The messages are SQLite's
// own and pin the extended codes the adapter opens connections with.
import { Suite } from "nish/testing";
import {
  OPEN_CREATE,
  OPEN_READONLY,
  OPEN_READWRITE,
  SQLITE_BLOB,
  SQLITE_CONSTRAINT,
  SQLITE_ERROR,
  SQLITE_FLOAT,
  SQLITE_INTEGER,
  SQLITE_MISUSE,
  SQLITE_NULL,
  SQLITE_RANGE,
  SQLITE_TEXT,
  Database,
  openDatabase,
  sqliteVersion,
} from "nish/sqlite";

const opens = (t: Suite): void => {
  t.ok("version", sqliteVersion().startsWith("3."));
  const bad = openDatabase(":memory:", OPEN_CREATE);
  if (bad.isErr()) {
    t.eqI32("open: CREATE alone is MISUSE", bad.error.code, SQLITE_MISUSE);
    t.eqStr("open: its message", bad.error.message, "bad parameter or other API misuse");
  } else {
    t.fail("open: CREATE alone is MISUSE", "it opened");
  }
  const missing = openDatabase("/nonexistent-dir/x.db", OPEN_READWRITE | OPEN_CREATE);
  if (missing.isErr()) {
    t.eqI32("open: a missing directory is CANTOPEN", missing.error.code, 14);
    t.eqStr("open: its message", missing.error.message, "unable to open database file");
  } else {
    t.fail("open: a missing directory is CANTOPEN", "it opened");
  }
  const ro = openDatabase(":memory:", OPEN_READONLY);
  if (ro.isOk()) {
    t.pass("open: READONLY");
    t.eqI32("close: READONLY", ro.value.close().ok ? 0 : 1, 0);
  } else {
    t.fail("open: READONLY", ro.error.message);
  }
};

const execs = (t: Suite, db: Database): void => {
  const made = db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT UNIQUE, score REAL, data BLOB)");
  t.ok("exec: CREATE", made.isOk());
  const typo = db.exec("CREAT TABLE u (x)");
  if (typo.isErr()) {
    t.eqI32("exec: a syntax error is ERROR", typo.error, SQLITE_ERROR);
    t.eqStr("exec: its message", db.error(typo.error).message, `near "CREAT": syntax error`);
  } else {
    t.fail("exec: a syntax error is ERROR", "it ran");
  }
  t.ok("begin", db.begin().isOk());
  t.ok("exec: INSERT", db.exec("INSERT INTO t (name, score) VALUES ('ada', 1.5)").isOk());
  t.eqI64("lastInsertRowid", db.lastInsertRowid(), toI64(1));
  t.eqI64("changes", db.changes(), toI64(1));
  t.ok("commit", db.commit().isOk());
  t.ok("commit: none open is ERROR", db.commit().isErr());
  t.ok("begin again", db.begin().isOk());
  t.ok("exec: INSERT to roll back", db.exec("INSERT INTO t (name) VALUES ('gone')").isOk());
  t.ok("rollback", db.rollback().isOk());
  t.ok("rollback: none open is ERROR", db.rollback().isErr());
};

const binds = (t: Suite, db: Database): void => {
  const empty = db.prepare("  -- nothing");
  if (empty.isErr()) {
    t.eqI32("prepare: no statement is MISUSE", empty.error.code, SQLITE_MISUSE);
  } else {
    t.fail("prepare: no statement is MISUSE", "it prepared");
  }
  const wrong = db.prepare("SELECT nope FROM t");
  if (wrong.isErr()) {
    t.eqI32("prepare: an unknown column is ERROR", wrong.error.code, SQLITE_ERROR);
    t.eqStr("prepare: its message", wrong.error.message, "no such column: nope");
  } else {
    t.fail("prepare: an unknown column is ERROR", "it prepared");
  }
  const p = db.prepare("INSERT INTO t (name, score, data, id) VALUES (?1, ?2, ?3, ?4)");
  if (p.isErr()) {
    t.fail("prepare: INSERT", p.error.message);
    return;
  }
  const ins = p.value;
  const bytes: u8[] = [104, 105, 33, 0, 255];
  t.ok("bindText", ins.bindText(1, "bob").isOk());
  t.ok("bindF64", ins.bindF64(2, toF64(9) / toF64(4)).isOk());
  t.ok("bindBlob", ins.bindBlob(3, bytes, 3, 2).isOk());
  t.ok("bindI64", ins.bindI64(4, toI64(10)).isOk());
  const stepped = ins.step();
  t.ok("step: INSERT is done", stepped.isOk() && !stepped.value);
  t.ok("reset", ins.reset().isOk());
  t.ok("bindTextBytes", ins.bindTextBytes(1, bytes, 0, 3).isOk());
  t.ok("bindNull", ins.bindNull(2).isOk());
  t.ok("bindBlob: empty is a blob, not NULL", ins.bindBlob(3, bytes, 5, 0).isOk());
  t.ok("bindI64 again", ins.bindI64(4, toI64(11)).isOk());
  t.ok("step: second INSERT", ins.step().isOk());
  t.ok("reset again", ins.reset().isOk());
  const dup = ins.step();
  if (dup.isErr()) {
    t.eqI32("step: a duplicate key is CONSTRAINT", dup.error & 0xff, SQLITE_CONSTRAINT);
    t.eqI32("step: extended CONSTRAINT_PRIMARYKEY", dup.error, 1555);
    t.eqStr("step: its message", ins.error(dup.error).message, "UNIQUE constraint failed: t.id");
  } else {
    t.fail("step: a duplicate key is CONSTRAINT", "it inserted");
  }
  t.ok("reset after a failed step", ins.reset().isOk());
  t.ok("clearBindings", ins.clearBindings().isOk());
  const range = ins.bindI64(5, toI64(1));
  t.ok("bindI64: index 5 of 4 is RANGE", range.isErr() && range.error === SQLITE_RANGE);
  const win = ins.bindBlob(3, bytes, 4, 2);
  t.ok("bindBlob: a window past the end is MISUSE", win.isErr() && win.error === SQLITE_MISUSE);
  const neg = ins.bindTextBytes(1, bytes, -1, 1);
  t.ok("bindTextBytes: a negative offset is MISUSE", neg.isErr() && neg.error === SQLITE_MISUSE);
  t.ok("bindText: index 0 is RANGE", ins.bindText(0, "x").isErr());
  t.ok("bindF64: index 0 is RANGE", ins.bindF64(0, toF64(1)).isErr());
  t.ok("bindNull: index 0 is RANGE", ins.bindNull(0).isErr());
  t.ok("finalize", ins.finalize().isOk());
  t.ok("finalize: twice is MISUSE", ins.finalize().isErr());
  const stale = ins.bindI64(1, toI64(1));
  t.ok("bindI64: after finalize is MISUSE", stale.isErr() && stale.error === SQLITE_MISUSE);
  t.ok("step: after finalize is MISUSE", ins.step().isErr());
  t.ok("reset: after finalize is MISUSE", ins.reset().isErr());
  t.ok("clearBindings: after finalize is MISUSE", ins.clearBindings().isErr());
  t.eqStr("error: after finalize", ins.error(SQLITE_MISUSE).message, "bad parameter or other API misuse");
};

const reads = (t: Suite, db: Database): void => {
  const p = db.prepare("SELECT id, name, score, data FROM t ORDER BY id");
  if (p.isErr()) {
    t.fail("prepare: SELECT", p.error.message);
    return;
  }
  const q = p.value;
  t.eqI32("columnCount", q.columnCount(), 4);
  const buf: u8[] = [0, 0, 0, 0, 0, 0, 0, 0];
  let rows: i32 = 0;
  let sum: i64 = 0;
  // The loop keeps a flag, not the last `Result`: a pass's arena is rewound
  // when it ends, so a `Result` stepped inside it does not outlive the loop
  // (#899). Carry the `Result` again once #899 is fixed.
  let done = false;
  for (;;) {
    const r = q.step();
    if (r.isErr() || !r.value) {
      done = r.isOk();
      break;
    }
    rows += 1;
    sum += q.columnI64(0);
  }
  t.ok("step: the rows end in DONE", done);
  t.eqI32("step: three rows", rows, 3);
  t.eqI64("columnI64: the ids", sum, toI64(22));
  t.ok("reset: to read again", q.reset().isOk());
  const first = q.step();
  t.ok("step: the first row", first.isOk() && first.value);
  t.eqI32("columnType: INTEGER", q.columnType(0), SQLITE_INTEGER);
  t.eqI32("columnType: TEXT", q.columnType(1), SQLITE_TEXT);
  t.eqI32("columnType: FLOAT", q.columnType(2), SQLITE_FLOAT);
  t.eqI32("columnType: NULL", q.columnType(3), SQLITE_NULL);
  t.eqI32("columnType: past the end is NULL", q.columnType(9), SQLITE_NULL);
  t.eqF64("columnF64", q.columnF64(2), toF64(3) / toF64(2));
  t.eqF64("columnF64: past the end is 0", q.columnF64(9), toF64(0));
  t.eqI64("columnI64: past the end is 0", q.columnI64(9), toI64(0));
  t.eqI32("columnBytes", q.columnBytes(1), 3);
  t.eqI32("columnBytes: NULL is 0", q.columnBytes(3), 0);
  const name = q.columnText(1);
  t.eqStr("columnText", name === null ? "<null>" : name, "ada");
  t.ok("columnText: NULL is null", q.columnText(3) === null);
  const got = q.columnInto(1, buf, 2);
  t.ok("columnInto: text", got.isOk() && got.value === 3);
  t.eqStr("columnInto: the bytes", String.fromBytes(buf, 2, 5), "ada");
  const tight = q.columnInto(1, buf, 6);
  t.ok("columnInto: too little room answers the length", tight.isOk() && tight.value === 3);
  t.eqI32("columnInto: and writes nothing", toI32(buf[6]), 0);
  const past = q.columnInto(9, buf, 0);
  t.ok("columnInto: past the end is RANGE", past.isErr() && past.error === SQLITE_RANGE);
  const at = q.columnInto(1, buf, 9);
  t.ok("columnInto: an offset past the buffer is MISUSE", at.isErr() && at.error === SQLITE_MISUSE);
  const second = q.step();
  t.ok("step: the second row", second.isOk() && second.value);
  t.eqI32("columnType: BLOB", q.columnType(3), SQLITE_BLOB);
  const blob = q.columnInto(3, buf, 0);
  t.ok("columnInto: blob", blob.isOk() && blob.value === 2);
  t.eqI32("columnInto: blob byte 0", toI32(buf[0]), 0);
  t.eqI32("columnInto: blob byte 1", toI32(buf[1]), 255);
  const third = q.step();
  t.ok("step: the third row", third.isOk() && third.value);
  const bound = q.columnText(1);
  t.eqStr("columnText: the bytes bound as text", bound === null ? "<null>" : bound, "hi!");
  t.eqI32("columnType: an empty blob is BLOB", q.columnType(3), SQLITE_BLOB);
  t.eqI32("columnBytes: an empty blob", q.columnBytes(3), 0);
  const nothing = q.columnInto(3, buf, 8);
  t.ok("columnInto: an empty blob at the end", nothing.isOk() && nothing.value === 0);
  const nul = db.prepare("SELECT ?1").expect("prepare a NUL");
  const anb = new Array<u8>(3);
  anb[0] = 97;
  anb[2] = 98;
  nul.bindTextBytes(1, anb, 0, 3).expect("bind a NUL");
  nul.step().expect("step a NUL");
  t.eqI32("columnBytes: a NUL inside text is counted", nul.columnBytes(0), 3);
  const cut = nul.columnText(0);
  t.eqStr("columnText: stops at a NUL", cut === null ? "<null>" : cut, "a");
  t.ok("close: with a statement open", db.close().isOk());
  t.ok("close: twice is MISUSE", db.close().isErr());
  t.eqI32("columnCount: after close is 0", q.columnCount(), 0);
  t.ok("step: a statement closed with its database is MISUSE", q.step().isErr());
  t.ok("finalize: after close is MISUSE", q.finalize().isErr());
  t.ok("exec: after close is MISUSE", db.exec("SELECT 1").isErr());
  t.ok("prepare: after close is MISUSE", db.prepare("SELECT 1").isErr());
  // Generation 1 of slot 0, which no connection is ever given.
  t.ok("exec: a handle naming slot 0 is MISUSE", new Database(65536).exec("SELECT 1").isErr());
  t.eqStr("error: after close", db.error(SQLITE_MISUSE).message, "bad parameter or other API misuse");
  t.eqI64("lastInsertRowid: after close is 0", db.lastInsertRowid(), toI64(0));
  t.eqI64("changes: after close is 0", db.changes(), toI64(0));
};

/** A file database, so the pragmas answer what a file connection does. */
const files = (t: Suite): void => {
  const opened = openDatabase("build/std_sqlite_wal.db", OPEN_READWRITE | OPEN_CREATE);
  if (opened.isErr()) {
    t.fail("open: a file", opened.error.message);
    return;
  }
  const db = opened.value;
  const mode = db.prepare("PRAGMA journal_mode=WAL");
  if (mode.isOk() && mode.value.step().isOk()) {
    const answer = mode.value.columnText(0);
    t.eqStr("pragma: journal_mode=WAL answers wal", answer === null ? "<null>" : answer, "wal");
    t.ok("finalize: the pragma", mode.value.finalize().isOk());
  } else {
    t.fail("pragma: journal_mode=WAL answers wal", "it did not run");
  }
  t.ok("pragma: synchronous=NORMAL", db.exec("PRAGMA synchronous=NORMAL").isOk());
  t.ok("exec: a table in the file", db.exec("DROP TABLE IF EXISTS f; CREATE TABLE f (x)").isOk());
  t.ok("exec: a row in the file", db.exec("INSERT INTO f VALUES (1)").isOk());
  t.ok("close: the file", db.close().isOk());
};

/** One statement prepared once and run 1,000 times, rebound each time. */
const reuses = (t: Suite, db: Database): void => {
  t.ok("exec: the reuse table", db.exec("CREATE TABLE r (k INTEGER PRIMARY KEY, v TEXT)").isOk());
  const p = db.prepare("INSERT INTO r (k, v) VALUES (?1, ?2) ON CONFLICT DO NOTHING");
  if (p.isErr()) {
    t.fail("prepare: the reused INSERT", p.error.message);
    return;
  }
  const ins = p.value;
  const text: u8[] = [97, 98, 99, 100];
  let failures: i32 = 0;
  for (let i: i32 = 0; i < 1000; i++) {
    const bound = ins.bindI64(1, toI64(i)).isOk() && ins.bindTextBytes(2, text, i % 4, 1).isOk();
    const stepped = ins.step();
    if (!bound || stepped.isErr() || stepped.value || ins.reset().isErr()) {
      failures += 1;
    }
  }
  t.eqI32("reset and rebind: 1,000 inserts", failures, 0);
  t.ok("bindI64: a key already there", ins.bindI64(1, toI64(7)).isOk());
  t.ok("step: ON CONFLICT DO NOTHING", ins.step().isOk());
  t.eqI64("changes: DO NOTHING changed nothing", db.changes(), toI64(0));
  t.ok("finalize: the reused INSERT", ins.finalize().isOk());
  const count = db.prepare("SELECT count(*), sum(k) FROM r WHERE v = 'b'");
  if (count.isOk() && count.value.step().isOk()) {
    t.eqI64("columnI64: every fourth row is b", count.value.columnI64(0), toI64(250));
    t.eqI64("columnI64: their keys", count.value.columnI64(1), toI64(124750));
    t.ok("finalize: the count", count.value.finalize().isOk());
  } else {
    t.fail("columnI64: every fourth row is b", "the count did not run");
  }
};

/** 100,000 rows stepped and read into one buffer leave `Arena.used()` where the first row did. */
const flat = (t: Suite, db: Database): void => {
  const p = db.prepare(
    "WITH RECURSIVE n(i) AS (VALUES (1) UNION ALL SELECT i + 1 FROM n WHERE i < 100000) SELECT i, 'row ' || i, i * 0.5 FROM n"
  );
  if (p.isErr()) {
    t.fail("prepare: 100,000 rows", p.error.message);
    return;
  }
  const q = p.value;
  const buf: u8[] = new Array<u8>(32);
  let sum: i64 = 0;
  let bytes: i64 = 0;
  let half: f64 = 0;
  let done = false;
  const after: i64 = Arena.used();
  for (;;) {
    const r = q.step();
    if (r.isErr() || !r.value) {
      done = r.isOk();
      break;
    }
    sum += q.columnI64(0);
    const got = q.columnInto(1, buf, 0);
    if (got.isOk()) {
      bytes += toI64(got.value);
    }
    half += q.columnF64(2);
  }
  t.eqI64("step: Arena.used() after 100,000 rows is what it was after the first", Arena.used() - after, toI64(0));
  t.ok("step: the rows end in DONE", done);
  const ids: i64 = 5000050000;
  t.eqI64("columnI64: 100,000 rows", sum, ids);
  t.eqI64("columnInto: their text", bytes, toI64(888895));
  t.eqF64("columnF64: their halves", half, toF64(2500025000));
  t.ok("finalize: 100,000 rows", q.finalize().isOk());
};

export const main = (): i32 => {
  const t = new Suite("std_sqlite");
  opens(t);
  const opened = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE);
  if (opened.isErr()) {
    t.fail("open", opened.error.message);
    return t.done();
  }
  const db = opened.value;
  files(t);
  reuses(t, db);
  flat(t, db);
  execs(t, db);
  binds(t, db);
  reads(t, db);
  return t.done();
};

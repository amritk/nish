// `nish/sqlite` end to end on an in-memory database: every call of the module,
// each once where it succeeds and once where it fails, and the failure's code
// and message. The table and the statements are made here, so the messages are
// SQLite's own and pin the extended codes the adapter opens connections with.
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
  let r = q.step();
  while (r.isOk() && r.value) {
    rows += 1;
    sum += q.columnI64(0);
    r = q.step();
  }
  t.ok("step: the rows end in DONE", r.isOk());
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
  t.ok("close: with a statement open", db.close().isOk());
  t.ok("close: twice is MISUSE", db.close().isErr());
  t.eqI32("columnCount: after close is 0", q.columnCount(), 0);
  t.ok("step: a statement closed with its database is MISUSE", q.step().isErr());
  t.ok("finalize: after close is MISUSE", q.finalize().isErr());
  t.ok("exec: after close is MISUSE", db.exec("SELECT 1").isErr());
  t.ok("prepare: after close is MISUSE", db.prepare("SELECT 1").isErr());
  t.eqStr("error: after close", db.error(SQLITE_MISUSE).message, "bad parameter or other API misuse");
  t.eqI64("lastInsertRowid: after close is 0", db.lastInsertRowid(), toI64(0));
  t.eqI64("changes: after close is 0", db.changes(), toI64(0));
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
  execs(t, db);
  binds(t, db);
  reads(t, db);
  return t.done();
};

// The cursor adapter keeps the shapes `openCursor` has checked, per
// connection, and answers a repeated open from them while the schema cookie is
// unchanged. Every route that changes the schema must make a kept shape miss:
// a column added in place (same root page), a table dropped and made again, a
// change another connection commits, and a change inside a write transaction
// that is rolled back and then followed by a committed change of as many DDL
// statements, which brings the cookie back to the value the rolled-back one
// had. More shapes than the cache holds are each still answered right, and
// `close` frees the kept ones (tests/run.js links this program again with
// `-DSQLITE_DEBUG`, whose asserts check that it holds the connection's mutex
// while it does).
import { Suite } from "nish/testing";
import { OPEN_CREATE, OPEN_READWRITE, SEEK_GE, SQLITE_SCHEMA, Database, openDatabase } from "nish/sqlite";
import { spawnSync } from "nish:process";

const path: string = "build/std_sqlite_cursor_shapes.db";
const clean = (): void => {
  spawnSync(["rm", "-f", path, `${path}-journal`, `${path}-wal`, `${path}-shm`]);
};

/** What opening `name` with `columns` in a new read answers: "ok", "schema" or the code. */
const opens = (db: Database, name: string, columns: string): string => {
  if (db.beginRead().isErr()) return "beginRead failed";
  const r = db.openCursor(name, columns);
  const out: string = r.isOk() ? "ok" : r.error.code === SQLITE_SCHEMA ? "schema" : `code ${r.error.code}`;
  if (db.endRead().isErr()) return "endRead failed";
  return out;
};

/** Column 1 of row `id` of `name`, read through a cursor of `columns` in a new read; -1 on a failure. */
const second = (db: Database, name: string, columns: string, id: i64): i64 => {
  if (db.beginRead().isErr()) return toI64(-1);
  const c = db.openCursor(name, columns);
  let v: i64 = toI64(-1);
  if (c.isOk()) {
    const found = c.value.seekRowid(id);
    if (found.isOk() && found.value) v = c.value.columnI64(1);
  }
  if (db.endRead().isErr()) return toI64(-1);
  return v;
};

/** The rowid the index `t_b` ("b,rowid") finds for key `b`, in a new read; -1 on a failure. */
const byIndex = (db: Database, b: i64): i64 => {
  if (db.beginRead().isErr()) return toI64(-1);
  const c = db.openCursor("t_b", "b,rowid");
  let v: i64 = toI64(-1);
  if (c.isOk() && c.value.keyReset().isOk() && c.value.keyI64(b).isOk()) {
    const at = c.value.seek(SEEK_GE);
    if (at.isOk() && at.value && c.value.columnI64(0) === b) v = c.value.rowid();
  }
  if (db.endRead().isErr()) return toI64(-1);
  return v;
};

const run = (t: Suite, db: Database, other: Database): void => {
  t.ok(
    "setup",
    db
      .exec(
        "CREATE TABLE t (a INTEGER PRIMARY KEY, b INTEGER); CREATE INDEX t_b ON t (b);" +
          "INSERT INTO t VALUES (1, 10), (2, 20), (3, 30)"
      )
      .isOk()
  );

  // A shape opened again reads the same.
  t.eqI64("first open: t row 2", second(db, "t", "a,b", toI64(2)), toI64(20));
  t.eqI64("kept shape: t row 2", second(db, "t", "a,b", toI64(2)), toI64(20));
  t.eqI64("first open: t_b finds 30", byIndex(db, toI64(30)), toI64(3));
  t.eqI64("kept shape: t_b finds 30", byIndex(db, toI64(30)), toI64(3));
  t.eqI64("kept shape: t_b finds 10", byIndex(db, toI64(10)), toI64(1));

  // A column added in place: the root page is the same, only the cookie moves.
  t.ok("add column: runs", db.exec("ALTER TABLE t ADD COLUMN c INTEGER").isOk());
  t.eqStr("add column: the kept shape is refused", opens(db, "t", "a,b"), "schema");
  t.eqStr("add column: the new shape opens", opens(db, "t", "a,b,c"), "ok");
  t.eqI64("add column: the new shape reads row 3", second(db, "t", "a,b,c", toI64(3)), toI64(30));

  // A table dropped and made again with other columns.
  t.ok("remake: runs", db.exec("DROP TABLE t; CREATE TABLE t (x INTEGER PRIMARY KEY, y INTEGER); INSERT INTO t VALUES (1, 7)").isOk());
  t.eqStr("remake: the kept shape is refused", opens(db, "t", "a,b,c"), "schema");
  t.eqStr("remake: and the dropped index", opens(db, "t_b", "b,rowid"), "schema");
  t.eqI64("remake: the new shape reads row 1", second(db, "t", "x,y", toI64(1)), toI64(7));

  // A change inside a write transaction, opened there, then rolled back; then
  // the same number of DDL statements committed, which puts the cookie where
  // the rolled-back transaction had it.
  t.ok("rollback: BEGIN and two DDL statements", db.exec("BEGIN; DROP TABLE t; CREATE TABLE t (p INTEGER PRIMARY KEY, q INTEGER)").isOk());
  const inWrite = db.openCursor("t", "p,q");
  t.ok("rollback: the shape opens inside the write", inWrite.isOk());
  t.ok("rollback: ROLLBACK", db.exec("ROLLBACK").isOk());
  t.eqStr("rollback: the rolled-back shape is refused", opens(db, "t", "p,q"), "schema");
  t.eqI64("rollback: the committed shape still reads row 1", second(db, "t", "x,y", toI64(1)), toI64(7));
  t.ok("rollback: two DDL statements committed", db.exec("DROP TABLE t; CREATE TABLE t (r INTEGER PRIMARY KEY, s INTEGER); INSERT INTO t VALUES (1, 9)").isOk());
  t.eqStr("rollback: the rolled-back shape is still refused", opens(db, "t", "p,q"), "schema");
  t.eqStr("rollback: and the one before", opens(db, "t", "x,y"), "schema");
  t.eqI64("rollback: the committed shape reads row 1", second(db, "t", "r,s", toI64(1)), toI64(9));

  // A change another connection commits.
  t.eqI64("other connection: the shape is kept", second(db, "t", "r,s", toI64(1)), toI64(9));
  t.ok("other connection: remakes t", other.exec("DROP TABLE t; CREATE TABLE t (m INTEGER PRIMARY KEY, n INTEGER); INSERT INTO t VALUES (1, 5)").isOk());
  t.eqStr("other connection: the kept shape is refused", opens(db, "t", "r,s"), "schema");
  t.eqI64("other connection: the new shape reads row 1", second(db, "t", "m,n", toI64(1)), toI64(5));

  // More shapes than the cache keeps (8), each opened twice over.
  let made = true;
  for (let i: i32 = 0; i < 12; i += 1) {
    made = made && db.exec(`CREATE TABLE u${i} (k INTEGER PRIMARY KEY, v INTEGER); INSERT INTO u${i} VALUES (1, ${i * 3})`).isOk();
  }
  t.ok("many shapes: twelve tables", made);
  let right = 0;
  for (let pass: i32 = 0; pass < 2; pass += 1) {
    for (let i: i32 = 0; i < 12; i += 1) {
      if (second(db, `u${i}`, "k,v", toI64(1)) === toI64(i) * toI64(3)) right += 1;
    }
  }
  t.eqI32("many shapes: each read right on both passes", right, 24);
  t.eqStr("many shapes: a wrong shape for one is refused", opens(db, "u11", "k"), "schema");
};

export const main = (): i32 => {
  const t = new Suite("std_sqlite_cursor_shapes");
  clean();
  const a = openDatabase(path, OPEN_READWRITE | OPEN_CREATE);
  const b = openDatabase(path, OPEN_READWRITE);
  if (a.isErr() || b.isErr()) {
    t.fail("open", "a connection did not open");
    clean();
    return t.done();
  }
  run(t, a.value, b.value);
  t.ok("close: the connection with kept shapes", a.value.close().isOk());
  t.ok("close: the other", b.value.close().isOk());
  clean();
  return t.done();
};

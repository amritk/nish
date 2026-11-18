// A cursor left open across every route that ends or writes its read
// transaction: `exec("COMMIT")`, `exec("ROLLBACK")`, `commit()`,
// `rollback()`, an INSERT through `exec` and through a prepared statement, a
// ROLLBACK through a prepared statement, `endRead`, an UPDATE, a DELETE and
// DDL that leave the read open, SAVEPOINT then RELEASE, `PRAGMA x = y`, a
// SELECT on a pragma table-valued function, and `close`. A closed cursor's
// handle also stays dead once a new cursor takes its freed slot. Each route leaves its
// cursors on a row partway through, and then checks that every call on them
// answers `SQLITE_MISUSE` (0 from `rowid` and `columnI64`); most also check
// that a new read sees what the route left. A route that leaves the read open
// is checked before `endRead` ends it, so only the route itself can have
// invalidated the cursors. tests/run.js links this program again
// with `-DSQLITE_DEBUG`, so a route that let SQLite reach a cursor the
// adapter had not closed fails an assertion there.
import { Suite } from "nish/testing";
import {
  OPEN_CREATE,
  OPEN_READWRITE,
  SEEK_GE,
  SQLITE_ERROR,
  SQLITE_MISUSE,
  Cursor,
  Database,
  openDatabase,
} from "nish/sqlite";

/** `r` is `Err(SQLITE_MISUSE)`. */
const moveMisuse = (r: Result<boolean, i32>): boolean => r.isErr() && r.error === SQLITE_MISUSE;

/** `r` is `Err(SQLITE_MISUSE)`. */
const voidMisuse = (r: Result<void, i32>): boolean => r.isErr() && r.error === SQLITE_MISUSE;

/** `r` is `Err(SQLITE_MISUSE)`. */
const i32Misuse = (r: Result<i32, i32>): boolean => r.isErr() && r.error === SQLITE_MISUSE;

/** Every call on `c` answers MISUSE, and its close does too. */
const dead = (c: Cursor, buf: u8[]): boolean => {
  let ok = moveMisuse(c.first()) && moveMisuse(c.last()) && moveMisuse(c.next());
  ok = ok && moveMisuse(c.previous()) && moveMisuse(c.seekRowid(toI64(2)));
  ok = ok && voidMisuse(c.keyReset()) && voidMisuse(c.keyI64(toI64(1)));
  ok = ok && voidMisuse(c.keyText("n1")) && voidMisuse(c.keyTextBytes(buf, 0, 1));
  ok = ok && moveMisuse(c.seek(SEEK_GE)) && c.rowid() === toI64(0);
  ok = ok && i32Misuse(c.columnType(0)) && c.columnI64(0) === toI64(0);
  ok = ok && i32Misuse(c.columnInto(1, buf, 0));
  return ok && voidMisuse(c.close());
};

/** Rows of `t`, read through a new read transaction. */
const rows = (db: Database): i32 => {
  if (db.beginRead().isErr()) return -1;
  const c = db.openCursor("t", "id,name").expect("open t");
  let n = 0;
  let r = c.first();
  while (r.isOk() && r.value) {
    n = n + 1;
    r = c.next();
  }
  if (db.endRead().isErr()) return -1;
  return n;
};

/** Prepares `sql` and steps it once to its end. */
const stepped = (d: Database, sql: string): boolean => {
  const st = d.prepare(sql).expect("prepare");
  const r = st.step();
  return r.isOk() && !r.value && st.finalize().isOk();
};

/**
 * Opens a read, a table and an index cursor on a row partway through, runs
 * `route`, and checks both cursors are dead and `t` then holds `want` rows.
 * With `open`, the route leaves the read open and `endRead` ends it after the
 * check.
 */
const route = (
  t: Suite,
  db: Database,
  name: string,
  run: (db: Database) => boolean,
  want: i32,
  open: boolean
): void => {
  const buf = new Array<u8>(8);
  t.ok(name + ": beginRead", db.beginRead().isOk());
  const c = db.openCursor("t", "id,name").expect("open t");
  const ix = db.openCursor("t_name", "name,rowid").expect("open t_name");
  const atRow = c.seekRowid(toI64(5));
  t.ok(name + ": the table cursor is on row 5", atRow.isOk() && atRow.value);
  t.ok(name + ": the index cursor is on an entry", ix.keyText("n1").isOk() && ix.seek(SEEK_GE).isOk());
  t.ok(name + ": runs", run(db));
  t.ok(name + ": leaves the table cursor dead", dead(c, buf));
  t.ok(name + ": and the index cursor", dead(ix, buf));
  if (open) t.ok(name + ": left the read open for endRead", db.endRead().isOk());
  t.eqI32(name + ": then t holds", rows(db), want);
};

/** A route that ends the read itself. */
const across = (t: Suite, db: Database, name: string, r: (db: Database) => boolean, want: i32): void =>
  route(t, db, name, r, want, false);

/** A route that leaves the read open. */
const within = (t: Suite, db: Database, name: string, r: (db: Database) => boolean, want: i32): void =>
  route(t, db, name, r, want, true);

export const main = (): i32 => {
  const t = new Suite("std_sqlite_cursor_stale");
  const opened = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE);
  if (opened.isErr()) {
    t.fail("open", opened.error.message);
    return t.done();
  }
  const db = opened.value;
  const schema =
    "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT);" +
    "CREATE INDEX t_name ON t (name);" +
    "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 50)" +
    " INSERT INTO t SELECT x, 'n' || (x % 5) FROM c";
  if (db.exec(schema).isErr()) {
    t.fail("exec", db.error(SQLITE_ERROR).message);
    return t.done();
  }
  // A new cursor opened into a closed one's slot: the old handle still
  // answers MISUSE, and its calls (its close too) leave the new one alone.
  // These are the program's first cursors and the cursor table's free list is
  // first-in, first-out, so the second takes the slot the first freed.
  const slotBuf = new Array<u8>(8);
  t.ok("freed slot: beginRead", db.beginRead().isOk());
  const old = db.openCursor("t", "id,name").expect("open t");
  t.ok("freed slot: the first cursor closes", old.close().isOk());
  const fresh = db.openCursor("t", "id,name").expect("open t again");
  const onRow = fresh.seekRowid(toI64(7));
  t.ok("freed slot: the new cursor is on row 7", onRow.isOk() && onRow.value);
  t.ok("freed slot: the old handle is dead", dead(old, slotBuf));
  t.ok("freed slot: the new cursor is still on row 7", fresh.rowid() === toI64(7));
  const stepped7 = fresh.next();
  t.ok("freed slot: and steps to row 8", stepped7.isOk() && stepped7.value && fresh.rowid() === toI64(8));
  t.ok("freed slot: the new cursor closes", fresh.close().isOk());
  t.ok("freed slot: endRead", db.endRead().isOk());
  across(t, db, "exec COMMIT", (d: Database): boolean => d.exec("COMMIT").isOk(), 50);
  across(t, db, "exec ROLLBACK", (d: Database): boolean => d.exec("ROLLBACK").isOk(), 50);
  across(t, db, "commit()", (d: Database): boolean => d.commit().isOk(), 50);
  across(t, db, "rollback()", (d: Database): boolean => d.rollback().isOk(), 50);
  across(
    t,
    db,
    "exec INSERT",
    (d: Database): boolean => d.exec("INSERT INTO t (name) VALUES ('w')").isOk() && d.commit().isOk(),
    51
  );
  across(
    t,
    db,
    "prepared INSERT",
    (d: Database): boolean => {
      const st = d.prepare("INSERT INTO t (name) VALUES ('p')").expect("prepare");
      const r = st.step();
      return r.isOk() && !r.value && st.finalize().isOk() && d.rollback().isOk();
    },
    51
  );
  across(
    t,
    db,
    "prepared ROLLBACK",
    (d: Database): boolean => {
      const st = d.prepare("ROLLBACK").expect("prepare");
      const r = st.step();
      return r.isOk() && !r.value && st.finalize().isOk();
    },
    51
  );
  across(t, db, "endRead", (d: Database): boolean => d.endRead().isOk(), 51);
  within(t, db, "prepared UPDATE", (d: Database): boolean => stepped(d, "UPDATE t SET name = 'u' WHERE id = 1"), 51);
  within(t, db, "exec DELETE", (d: Database): boolean => d.exec("DELETE FROM t WHERE name = 'w'").isOk(), 50);
  within(t, db, "exec DDL", (d: Database): boolean => d.exec("CREATE TABLE extra (x)").isOk(), 50);
  within(t, db, "prepared DDL", (d: Database): boolean => stepped(d, "DROP TABLE extra"), 50);
  within(
    t,
    db,
    "SAVEPOINT then RELEASE",
    (d: Database): boolean => stepped(d, "SAVEPOINT s") && stepped(d, "RELEASE s"),
    50
  );
  within(t, db, "PRAGMA x = y", (d: Database): boolean => stepped(d, "PRAGMA cache_size = 100"), 50);
  const buf = new Array<u8>(8);
  // A SELECT on a pragma table-valued function authorizes SQLITE_PRAGMA, so
  // stepping it invalidates though the read transaction stays open.
  t.ok("pragma SELECT: beginRead", db.beginRead().isOk());
  const pc = db.openCursor("t", "id,name").expect("open t");
  const pragmaRow = pc.seekRowid(toI64(5));
  t.ok("pragma SELECT: the table cursor is on row 5", pragmaRow.isOk() && pragmaRow.value);
  const pq = db.prepare("SELECT count(*) FROM pragma_table_info('t')").expect("prepare");
  const ps = pq.step();
  t.ok("pragma SELECT: answers t's 2 columns", ps.isOk() && ps.value && pq.columnI64(0) === toI64(2));
  t.ok("pragma SELECT: finalize", pq.finalize().isOk());
  t.ok("pragma SELECT: leaves the cursor dead", dead(pc, buf));
  t.ok("pragma SELECT: inside a read that endRead still ends", db.endRead().isOk());
  t.ok("close: beginRead", db.beginRead().isOk());
  const c = db.openCursor("t", "id,name").expect("open t");
  const ix = db.openCursor("t_name", "name,rowid").expect("open t_name");
  t.ok("close: on a row", c.last().isOk() && ix.last().isOk());
  t.ok("close: closes the connection", db.close().isOk());
  t.ok("close: leaves the table cursor dead", dead(c, buf));
  t.ok("close: and the index cursor", dead(ix, buf));
  return t.done();
};

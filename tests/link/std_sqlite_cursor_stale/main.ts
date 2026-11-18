// A cursor left open across every route that ends or writes its read
// transaction: `exec("COMMIT")`, `exec("ROLLBACK")`, `commit()`,
// `rollback()`, an INSERT through `exec` and through a prepared statement, a
// ROLLBACK through a prepared statement, `endRead` and `close`. Each route
// opens a table cursor and an index cursor, leaves them on a row partway
// through, and then checks that every call on both answers `SQLITE_MISUSE`
// (0 from `rowid` and `columnI64`) and that a new read sees what the route
// left. tests/run.js links this program again with `-DSQLITE_DEBUG`, so a
// route that let SQLite reach a cursor the adapter had not closed fails an
// assertion there.
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

/**
 * Opens a read, a table and an index cursor on a row partway through, runs
 * `route`, and checks both cursors are dead and `t` then holds `want` rows.
 */
const across = (t: Suite, db: Database, name: string, route: (db: Database) => boolean, want: i32): void => {
  const buf = new Array<u8>(8);
  t.ok(name + ": beginRead", db.beginRead().isOk());
  const c = db.openCursor("t", "id,name").expect("open t");
  const ix = db.openCursor("t_name", "name,rowid").expect("open t_name");
  const atRow = c.seekRowid(toI64(5));
  t.ok(name + ": the table cursor is on row 5", atRow.isOk() && atRow.value);
  t.ok(name + ": the index cursor is on an entry", ix.keyText("n1").isOk() && ix.seek(SEEK_GE).isOk());
  t.ok(name + ": runs", route(db));
  t.ok(name + ": leaves the table cursor dead", dead(c, buf));
  t.ok(name + ": and the index cursor", dead(ix, buf));
  t.eqI32(name + ": then t holds", rows(db), want);
};

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
  const buf = new Array<u8>(8);
  t.ok("close: beginRead", db.beginRead().isOk());
  const c = db.openCursor("t", "id,name").expect("open t");
  const ix = db.openCursor("t_name", "name,rowid").expect("open t_name");
  t.ok("close: on a row", c.last().isOk() && ix.last().isOk());
  t.ok("close: closes the connection", db.close().isOk());
  t.ok("close: leaves the table cursor dead", dead(c, buf));
  t.ok("close: and the index cursor", dead(ix, buf));
  return t.done();
};

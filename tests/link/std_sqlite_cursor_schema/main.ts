// The tables and indexes `openCursor` refuses with `SQLITE_SCHEMA`, and the
// near misses it opens. A cursor reads a table of rowids by its columns as
// declared, and an index of one whose key is plain BINARY columns and then
// the rowid, in a UTF-8 database; anything else it cannot read as SQL would,
// so it refuses at open rather than answer something else: a column list in
// the wrong order, short or long, a WITHOUT ROWID table or an index on one, a
// view, a virtual table, a generated column, an index on an expression or
// with another collation, and a UTF-16 database. Last, a row shorter than its
// table (written before ALTER TABLE ADD COLUMN) answers SQLITE_SCHEMA for the
// columns it lacks.
import { Suite } from "nish/testing";
import { OPEN_CREATE, OPEN_READWRITE, SQLITE_ERROR, Database, openDatabase } from "nish/sqlite";

/** SQLITE_SCHEMA. */
const SCHEMA: i32 = 17;

/** `openCursor(name, columns)` is refused with SQLITE_SCHEMA. */
const refused = (db: Database, name: string, columns: string): boolean => {
  const r = db.openCursor(name, columns);
  return r.isErr() && r.error.code === SCHEMA;
};

/** `openCursor(name, columns)` opens, and the cursor closes. */
const opens = (db: Database, name: string, columns: string): boolean => {
  const r = db.openCursor(name, columns);
  return r.isOk() && r.value.close().isOk();
};

export const main = (): i32 => {
  const t = new Suite("std_sqlite_cursor_schema");
  const opened = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE);
  if (opened.isErr()) {
    t.fail("open", opened.error.message);
    return t.done();
  }
  const db = opened.value;
  const schema =
    "CREATE TABLE t (id INTEGER PRIMARY KEY, a TEXT, b INT);" +
    "CREATE INDEX t_ab ON t (a, b DESC);" +
    "CREATE INDEX t_part ON t (b) WHERE b > 0;" +
    "CREATE INDEX t_nocase ON t (a COLLATE NOCASE);" +
    "CREATE INDEX t_expr ON t (lower(a));" +
    "CREATE TABLE k (name TEXT PRIMARY KEY, v INT);" +
    "CREATE TABLE w (name TEXT PRIMARY KEY, v INT) WITHOUT ROWID;" +
    "CREATE INDEX w_v ON w (v);" +
    "CREATE TABLE g (x INT, y INT GENERATED ALWAYS AS (x * 2) VIRTUAL);" +
    "CREATE TABLE s (x INT, y INT GENERATED ALWAYS AS (x * 2) STORED);" +
    "CREATE TABLE n (x TEXT COLLATE NOCASE);" +
    "CREATE VIEW v AS SELECT id, a FROM t;" +
    "INSERT INTO t VALUES (1, 'A', 1), (2, 'b', 2)";
  if (db.exec(schema).isErr()) {
    t.fail("exec", db.error(SQLITE_ERROR).message);
    return t.done();
  }
  t.ok("beginRead", db.beginRead().isOk());
  t.ok("a table by its columns opens", opens(db, "t", "id,a,b"));
  t.ok("  in another order is refused", refused(db, "t", "a,id,b"));
  t.ok("  one column short", refused(db, "t", "id,a"));
  t.ok("  one column over", refused(db, "t", "id,a,b,c"));
  t.ok("  the rowid named again", refused(db, "t", "id,a,b,rowid"));
  t.ok("  an empty list", refused(db, "t", ""));
  t.ok("  in another case", refused(db, "t", "ID,a,b"));
  t.ok("an index by its key and rowid opens", opens(db, "t_ab", "a,b DESC,rowid"));
  t.ok("  without the rowid is refused", refused(db, "t_ab", "a,b DESC"));
  t.ok("  key columns swapped", refused(db, "t_ab", "b DESC,a,rowid"));
  t.ok("  a table's column over", refused(db, "t_ab", "a,b DESC,id,rowid"));
  t.ok("  `desc` in lower case", refused(db, "t_ab", "a,b desc,rowid"));
  t.ok("a partial index opens", opens(db, "t_part", "b,rowid"));
  t.ok("a NOCASE index is refused", refused(db, "t_nocase", "a,rowid"));
  t.ok("  as by NOCASE", refused(db, "t_nocase", "a COLLATE NOCASE,rowid"));
  t.ok("an index on an expression is refused", refused(db, "t_expr", "a,rowid"));
  t.ok("a TEXT PRIMARY KEY table opens", opens(db, "k", "name,v"));
  t.ok("  and its primary-key index", opens(db, "sqlite_autoindex_k_1", "name,rowid"));
  t.ok("a WITHOUT ROWID table is refused", refused(db, "w", "name,v"));
  t.ok("  and an index on one", refused(db, "w_v", "v,rowid"));
  t.ok("  and its primary key", refused(db, "sqlite_autoindex_w_1", "name,rowid"));
  t.ok("a virtual generated column is refused", refused(db, "g", "x,y"));
  t.ok("  as is one less it", refused(db, "g", "x"));
  t.ok("a stored generated column is refused", refused(db, "s", "x,y"));
  t.ok("a NOCASE column of a table opens", opens(db, "n", "x"));
  t.ok("a view is refused", refused(db, "v", "id,a"));
  t.ok("the schema table is refused", refused(db, "sqlite_schema", "type,name,tbl_name,rootpage,sql"));
  t.ok("a temp table is refused", db.endRead().isOk() && db.exec("CREATE TEMP TABLE tt (x INT)").isOk());
  t.ok("  beginRead", db.beginRead().isOk());
  t.ok("  is not in main", refused(db, "tt", "x"));
  t.ok("  nor is temp.tt", refused(db, "temp.tt", "x"));
  t.ok("endRead", db.endRead().isOk());
  // The default build has no virtual-table module; tests/run.js links this
  // program again with -DSQLITE_ENABLE_RTREE and reads these lines' PASS.
  const vt = db.exec("CREATE VIRTUAL TABLE r USING rtree(id, x0, x1)");
  if (vt.isOk()) {
    t.ok("rtree: beginRead", db.beginRead().isOk());
    t.ok("rtree: a virtual table is refused", refused(db, "r", "id,x0,x1"));
    t.ok("rtree: and its shadow table", refused(db, "r_node", "nodeno,data"));
    t.ok("rtree: endRead", db.endRead().isOk());
  } else {
    t.eqStr("without rtree, CREATE VIRTUAL TABLE fails", db.error(vt.error).message, "no such module: rtree");
  }
  // A row written before ALTER TABLE ADD COLUMN is shorter than the table:
  // SQL reads the new column as its DEFAULT, which a cursor does not apply,
  // so the column past the end of that record answers SQLITE_SCHEMA (and
  // columnI64 0) rather than a value SQL would not give. A row written after
  // the ALTER reads normally.
  t.ok(
    "short record: ADD COLUMN with a DEFAULT and without",
    db
      .exec(
        "CREATE TABLE old (id INTEGER PRIMARY KEY, a INT); INSERT INTO old (a) VALUES (7);" +
          " ALTER TABLE old ADD COLUMN d INT DEFAULT 5; ALTER TABLE old ADD COLUMN n TEXT;" +
          " INSERT INTO old (a, d, n) VALUES (8, 9, 'new')"
      )
      .isOk()
  );
  t.ok("short record: beginRead", db.beginRead().isOk());
  const old = db.openCursor("old", "id,a,d,n").expect("open old");
  const buf = new Array<u8>(8);
  const first = old.first();
  t.ok("short record: the old row", first.isOk() && first.value);
  t.ok("  reads its own column", old.columnI64(1) === toI64(7));
  const dType = old.columnType(2);
  t.ok("  the DEFAULT column answers SQLITE_SCHEMA", dType.isErr() && dType.error === SCHEMA);
  t.ok("  and columnI64 0 there, not the DEFAULT", old.columnI64(2) === toI64(0));
  const nType = old.columnType(3);
  t.ok("  the column without a DEFAULT answers SQLITE_SCHEMA", nType.isErr() && nType.error === SCHEMA);
  const nInto = old.columnInto(3, buf, 0);
  t.ok("  and columnInto there SQLITE_SCHEMA", nInto.isErr() && nInto.error === SCHEMA);
  const second = old.next();
  t.ok("short record: the row written after the ALTER", second.isOk() && second.value);
  t.ok("  reads the DEFAULT column's own value", old.columnI64(2) === toI64(9));
  const n = old.columnInto(3, buf, 0);
  t.ok("  reads the other new column", n.isOk() && n.value === 3 && String.fromBytes(buf, 0, 3) === "new");
  t.ok("short record: endRead", db.endRead().isOk());

  // The column list joins names unescaped, so a name it could not spell apart
  // is refused: a comma would read as two columns, and " DESC" at the end as a
  // descending key column.
  t.ok(
    "names: a comma and a trailing DESC",
    db
      .exec(
        'CREATE TABLE odd (id INTEGER PRIMARY KEY, "a,b" INT, "c DESC" INT, e INT);' +
          ' CREATE INDEX odd_e ON odd (e DESC); CREATE INDEX odd_c ON odd ("c DESC")'
      )
      .isOk()
  );
  t.ok("names: beginRead", db.beginRead().isOk());
  t.ok("  a column name with a comma is SQLITE_SCHEMA", refused(db, "odd", "id,a,b,c DESC,e"));
  t.ok("  an index on a column named ... DESC is SQLITE_SCHEMA", refused(db, "odd_c", "c DESC,rowid"));
  t.ok("  a descending index on a plain name opens", opens(db, "odd_e", "e DESC,rowid"));
  t.ok("names: endRead", db.endRead().isOk());
  t.ok("close", db.close().isOk());

  const wide = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE).expect("open a second");
  t.ok("a UTF-16 database", wide.exec("PRAGMA encoding = 'UTF-16le'; CREATE TABLE u (x TEXT)").isOk());
  t.ok("  beginRead", wide.beginRead().isOk());
  t.ok("  is refused", refused(wide, "u", "x"));
  t.ok("  close", wide.close().isOk());
  return t.done();
};

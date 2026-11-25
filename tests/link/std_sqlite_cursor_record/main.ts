// `Cursor.record` and `RowRecord` against the per-column calls, and
// `Database.reopenCursor`. The table holds every serial type SQLite writes:
// integers of each width from 1 to 8 bytes and both signs, the constants 0
// and 1, REALs, NULLs, text longer than 57 bytes (a serial type of two
// varint bytes), a 6000-byte blob that spills onto overflow pages and is
// longer than the RowRecord's first buffer, an INTEGER PRIMARY KEY alias,
// and a column added by ALTER TABLE that the first rows' records are too
// short to hold. Every row's decoded fields must answer what `columnType`,
// `columnI64`, `columnF64` and `columnInto` answer, through the table and
// through an index whose record ends with the rowid.
import { Suite } from "nish/testing";
import {
  OPEN_CREATE,
  OPEN_READWRITE,
  SQLITE_BLOB,
  SQLITE_FLOAT,
  SQLITE_INTEGER,
  SQLITE_MISUSE,
  SQLITE_NULL,
  SQLITE_SCHEMA,
  SQLITE_TEXT,
  Cursor,
  Database,
  RowRecord,
  Statement,
  openDatabase,
} from "nish/sqlite";

/**
 * Whether field `k` of `row` answers what column `c` of `cur`'s row answers:
 * the same type, and the same integer, float or bytes.
 */
const fieldAgrees = (cur: Cursor, c: i32, row: RowRecord, k: i32, buf: u8[]): boolean => {
  const ty = cur.columnType(c);
  if (ty.isErr() || row.type(k) !== ty.value) return false;
  if (ty.value === SQLITE_INTEGER) return row.int(k) === cur.columnI64(c) && row.float(k) === toF64(row.int(k));
  // The cursor has no float read; `floatsAgree` holds REALs to SQL's.
  if (ty.value === SQLITE_FLOAT) return row.int(k) === toI64(0);
  if (ty.value === SQLITE_TEXT || ty.value === SQLITE_BLOB) {
    const n = cur.columnInto(c, buf, 0).expect("columnInto");
    if (row.size(k) !== n || row.int(k) !== toI64(0)) return false;
    for (let i = 0; i < n; i++) {
      if (row.buf[row.start(k) + i] !== buf[i]) return false;
    }
    return true;
  }
  return ty.value === SQLITE_NULL && row.size(k) === 0 && row.int(k) === toI64(0);
};

/** Whether `row`'s REAL fields, r and z, are the values SQL reads for its row: `q` selects them by rowid. */
const floatsAgree = (q: Statement, rowid: i64, row: RowRecord): boolean => {
  if (q.reset().isErr() || q.bindI64(1, rowid).isErr() || !q.step().expect("step")) return false;
  for (let k = 2; k <= 5; k = k + 3) {
    if (row.type(k) === SQLITE_FLOAT && row.float(k) !== q.columnF64(k === 2 ? 0 : 1)) return false;
  }
  return true;
};

/** Opens `t` and `ts` in a new read transaction, into the two cursors. */
const reopen = (db: Database, t: Cursor, ts: Cursor): boolean =>
  db.beginRead().isOk() && db.reopenCursor(t, "t", "id,n,r,s,b,z,late").isOk() && db.reopenCursor(ts, "ts", "s DESC,rowid").isOk();

export const main = (): i32 => {
  const t = new Suite("std_sqlite_cursor_record");
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE).expect("open");
  t.ok(
    "fill",
    db
      .exec(
        "CREATE TABLE t (id INTEGER PRIMARY KEY, n INTEGER, r REAL, s TEXT, b BLOB, z);" +
          "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 300)" +
          " INSERT INTO t SELECT x," +
          " CASE x % 9 WHEN 0 THEN NULL WHEN 1 THEN x - 150 WHEN 2 THEN (x - 150) * 1000" +
          "  WHEN 3 THEN (x - 150) * 100000 WHEN 4 THEN (x - 150) * 10000000" +
          "  WHEN 5 THEN (x - 150) * 10000000000 WHEN 6 THEN (x - 150) * 1000000000000000" +
          "  WHEN 7 THEN x % 2 ELSE -9223372036854775807 - 1 END," +
          " CASE WHEN x % 4 = 0 THEN x * 0.5 WHEN x % 4 = 1 THEN -1.0e300 / x ELSE x END," +
          " CASE WHEN x % 7 = 0 THEN NULL WHEN x % 5 = 0 THEN printf('%.*c', x, 'q')" +
          "  ELSE printf('s%d\"\\', x) END," +
          " CASE WHEN x % 11 = 0 THEN zeroblob(6000) WHEN x % 3 = 0 THEN x'' ELSE x'00ff' END," +
          " CASE x % 3 WHEN 0 THEN 1.25 WHEN 1 THEN 'z' ELSE NULL END FROM c;" +
          "ALTER TABLE t ADD COLUMN late INTEGER DEFAULT 9;" +
          "WITH RECURSIVE c(x) AS (SELECT 301 UNION ALL SELECT x + 1 FROM c WHERE x < 310)" +
          " INSERT INTO t SELECT x, x, x, '', x'', x, x * 2 FROM c;" +
          "CREATE INDEX ts ON t (s DESC);"
      )
      .isOk()
  );
  t.ok("beginRead", db.beginRead().isOk());
  const cur = db.openCursor("t", "id,n,r,s,b,z,late").expect("open t");
  const row = new RowRecord(64, 8);
  const reals = db.prepare("SELECT r, z FROM t WHERE id = ?1").expect("prepare");
  let floats = 0;
  const buf = new Array<u8>(8192);

  let rows = 0;
  let same = true;
  let short = 0;
  let grew = false;
  let r = cur.first();
  while (r.isOk() && r.value) {
    rows = rows + 1;
    if (row.read(cur).isErr()) same = false;
    if (row.buf.length > 64) grew = true;
    // The alias column is the row's key, so its field is NULL.
    if (row.type(0) !== SQLITE_NULL) same = false;
    for (let c = 1; c < 7; c++) {
      if (c < row.fields) {
        if (!fieldAgrees(cur, c, row, c, buf)) same = false;
      } else if (cur.columnType(c).isOk() || row.type(c) !== SQLITE_NULL) {
        same = false;
      }
    }
    if (row.fields === 6) short = short + 1;
    if (!floatsAgree(reals, cur.rowid(), row)) same = false;
    if (row.type(2) === SQLITE_FLOAT) floats = floats + 1;
    r = cur.next();
  }
  t.ok("table: the walk ends at its last row", r.isOk());
  t.eqI32("table: 310 rows", rows, 310);
  t.ok("table: every field answers what its column answers", same);
  t.eqI32("table: the 300 records written before ALTER TABLE hold 6 fields", short, 300);
  t.ok("table: an overflow row grew the buffer", grew);
  t.eqI32("table: the 75 rows with x % 4 = 1 hold a REAL; whole ones are stored as integers", floats, 75);

  t.ok("seekRowid 150", cur.seekRowid(toI64(150)).expect("seek"));
  const want = cur.record(new Array<u8>(0));
  t.ok("  record into no room answers the length", want.isOk() && want.value > 0);
  const tight = new Array<u8>(want.isOk() ? want.value - 1 : 0);
  for (let i = 0; i < tight.length; i++) tight[i] = 0xee;
  const one = cur.record(tight);
  let untouched = true;
  for (let i = 0; i < tight.length; i++) {
    if (tight[i] !== 0xee) untouched = false;
  }
  t.ok("  one byte short answers it too and copies nothing", one.isOk() && want.isOk() && one.value === want.value && untouched);
  const exact = new Array<u8>(want.isOk() ? want.value : 0);
  const fit = cur.record(exact);
  t.ok("  an exact fit copies the record", fit.isOk() && want.isOk() && fit.value === want.value);
  t.ok("  whose header length is its first byte", fit.isOk() && exact[0] > 0 && toI32(exact[0]) < fit.value);
  t.ok("  and the row reads", row.read(cur).isOk() && row.fields === 6);
  t.eqI64("  n, 150 % 9 = 6, is 0 * 10^15", row.int(1), toI64(0));
  t.ok("seekRowid 141, n = -9 * 10^15 in 8 bytes", cur.seekRowid(toI64(141)).expect("seek") && row.read(cur).isOk());
  const big: i64 = -9000000000000000;
  t.eqI64("  n", row.int(1), big);
  t.ok("seekRowid 8, the smallest i64", cur.seekRowid(toI64(8)).expect("seek") && row.read(cur).isOk());
  // -2^63, computed: the literal is past 2^53.
  const least: i64 = toI64(-1) << toI64(63);
  t.eqI64("  n", row.int(1), least);
  t.ok("seekRowid 25, a 25-byte text", cur.seekRowid(toI64(25)).expect("seek") && row.read(cur).isOk());
  t.ok("  s is TEXT", row.type(3) === SQLITE_TEXT && row.size(3) === 25);
  t.ok("seekRowid 295, a 295-byte text", cur.seekRowid(toI64(295)).expect("seek") && row.read(cur).isOk());
  t.ok("  s is TEXT with a two-byte serial type", row.type(3) === SQLITE_TEXT && row.size(3) === 295);
  t.ok("  past the fields is NULL", row.type(7) === SQLITE_NULL && row.type(-1) === SQLITE_NULL && row.size(99) === 0);

  // Through the index: key columns, then the rowid.
  const ix = db.openCursor("ts", "s DESC,rowid").expect("open ts");
  let entries = 0;
  same = true;
  let m = ix.first();
  while (m.isOk() && m.value) {
    entries = entries + 1;
    if (row.read(ix).isErr() || row.fields !== 2) same = false;
    if (!fieldAgrees(ix, 0, row, 0, buf) || row.type(1) !== SQLITE_INTEGER || row.int(1) !== ix.rowid()) same = false;
    m = ix.next();
  }
  t.ok("index: the walk ends at its last entry", m.isOk());
  t.eqI32("index: 310 entries", entries, 310);
  t.ok("index: each record is its key, then its rowid", same);

  t.ok("close", cur.close().isOk());
  const closed = cur.record(buf);
  t.ok("record on a closed cursor is MISUSE", closed.isErr() && closed.error === SQLITE_MISUSE);
  const failed = row.read(cur);
  t.ok("and RowRecord.read hands it on", failed.isErr() && failed.error === SQLITE_MISUSE && row.fields === 0);
  t.ok("endRead", db.endRead().isOk());

  // reopenCursor: two Cursor objects across 200 read transactions, each
  // reading what a new cursor would.
  const tc = db.openCursor("sqlite_schema", "type,name,tbl_name,rootpage,sql");
  t.ok("a cursor outside a read is refused", tc.isErr() && tc.error.code === SQLITE_MISUSE);
  t.ok("beginRead", db.beginRead().isOk());
  const a = db.openCursor("t", "id,n,r,s,b,z,late").expect("open t");
  const b = db.openCursor("ts", "s DESC,rowid").expect("open ts");
  t.ok("endRead", db.endRead().isOk());
  let passes = 0;
  let sum: i64 = 0;
  for (let p = 0; p < 200; p++) {
    if (!reopen(db, a, b)) break;
    if (a.seekRowid(toI64(p + 1)).expect("seek")) sum = sum + a.rowid();
    if (b.first().expect("first")) passes = passes + 1;
    if (db.endRead().isErr()) break;
  }
  t.eqI32("200 passes reopen both and read", passes, 200);
  t.eqI64("  each seek finds its row", sum, toI64(200 * 201 / 2));
  t.ok("reopen while the cursor is still open", db.beginRead().isOk() && db.reopenCursor(a, "t", "id,n,r,s,b,z,late").isOk());
  t.ok("  closes the old one and reads", db.reopenCursor(a, "t", "id,n,r,s,b,z,late").isOk() && a.first().expect("first"));
  const bad = db.reopenCursor(a, "t", "id,n");
  t.ok("reopen with other columns is SCHEMA", bad.isErr() && bad.error.code === SQLITE_SCHEMA);
  const gone = a.first();
  t.ok("  and leaves the cursor closed", gone.isErr() && gone.error === SQLITE_MISUSE);
  t.ok("  which reopens", db.reopenCursor(a, "t", "id,n,r,s,b,z,late").isOk() && a.first().expect("first"));
  t.ok("endRead", db.endRead().isOk());
  t.ok("finalize", reals.finalize().isOk());
  t.ok("close the database", db.close().isOk());
  return t.done();
};

// `Cursor.readRow` against the per-column calls. A 310-row table holds every
// trap in docs/sqlite-cursor.md's table: the INTEGER PRIMARY KEY alias, NULLs,
// a REAL column holding whole numbers (stored as integers) and halves, text,
// a 6000-byte blob on every eleventh row that spills onto overflow pages, a
// column of mixed types, and a column added by ALTER TABLE that the first 300
// records are too short to hold. Each row's one-call read is compared with
// `columnType`, `columnI64` and `columnInto` on every column, through the
// table and through an index on (s DESC); each refusal is pinned to its code
// and to a buffer left as it was. TEXT values that read as numbers ('42',
// '7abc') pin that readRow converts no TEXT or BLOB to an integer, where
// `columnI64` does.
import { Suite } from "nish/testing";
import {
  OPEN_CREATE,
  OPEN_READWRITE,
  SQLITE_BLOB,
  SQLITE_MISUSE,
  SQLITE_RANGE,
  SQLITE_SCHEMA,
  SQLITE_TEXT,
  Cursor,
  openDatabase,
} from "nish/sqlite";

/** `r` is `Err(code)`. */
const i32Err = (r: Result<i32, i32>, code: i32): boolean => r.isErr() && r.error === code;

/** `r` is `Err(code)`. */
const voidErr = (r: Result<void, i32>, code: i32): boolean => r.isErr() && r.error === code;

/**
 * Whether `readRow` with `cols` chosen answers on the cursor's current row
 * what the per-column calls answer: the same refusal for the row as the
 * first column `columnType` refuses, or each column's type and bytes, and
 * `columnI64`'s integer for a number, 0 for TEXT, BLOB and NULL.
 */
const agrees = (cur: Cursor, cols: i32[], text: u8[], buf: u8[]): boolean => {
  const ints = new Array<i64>(cols.length);
  const spans = new Array<i32>(3 * cols.length);
  if (cur.selectRow(cols).isErr()) return false;
  const got = cur.readRow(ints, spans, text);
  let need = 0;
  for (let k = 0; k < cols.length; k++) {
    const ty = cur.columnType(cols[k]);
    if (ty.isErr()) return got.isErr() && got.error === ty.error;
    if (got.isErr() || spans[3 * k] !== ty.value) return false;
    if (ty.value === SQLITE_TEXT || ty.value === SQLITE_BLOB) {
      const n = cur.columnInto(cols[k], buf, 0).expect("columnInto");
      if (ints[k] !== toI64(0) || spans[3 * k + 1] !== need || spans[3 * k + 2] !== n) return false;
      for (let i = 0; i < n; i++) {
        if (text[need + i] !== buf[i]) return false;
      }
      need = need + n;
    } else if (ints[k] !== cur.columnI64(cols[k]) || spans[3 * k + 1] !== 0 || spans[3 * k + 2] !== 0) {
      return false;
    }
  }
  return got.isOk() && got.value === need;
};

/** Every element of `a` is `v`. */
const allI32 = (a: i32[], v: i32): boolean => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== v) return false;
  }
  return true;
};

/** Every element of `a` is `v`. */
const allI64 = (a: i64[], v: i64): boolean => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== v) return false;
  }
  return true;
};

export const main = (): i32 => {
  const t = new Suite("std_sqlite_cursor_row");
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE).expect("open");
  t.ok(
    "fill",
    db
      .exec(
        "CREATE TABLE t (id INTEGER PRIMARY KEY, n INTEGER, r REAL, s TEXT, b BLOB, z);" +
          "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 300)" +
          " INSERT INTO t SELECT x, CASE WHEN x % 5 = 0 THEN NULL ELSE x * 3 - 400 END, x * 0.5," +
          " CASE WHEN x % 7 = 0 THEN NULL WHEN x % 13 = 0 THEN printf('%d', x) WHEN x % 17 = 0 THEN '7abc'" +
          " ELSE printf('s%d', x) END," +
          " CASE WHEN x % 11 = 0 THEN zeroblob(6000) ELSE x'0102' END," +
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
  const text = new Array<u8>(16384);
  const buf = new Array<u8>(8192);
  const every: i32[] = [0, 1, 2, 3, 4, 5];
  const late: i32[] = [6, 0, 3];
  const twice: i32[] = [4, 3, 4, 0, 3];
  const empty: i32[] = [];
  let rows = 0;
  let same = true;
  let schema = 0;
  let r = cur.first();
  while (r.isOk() && r.value) {
    rows = rows + 1;
    if (!agrees(cur, every, text, buf) || !agrees(cur, late, text, buf) || !agrees(cur, twice, text, buf)) {
      same = false;
    }
    if (cur.columnType(6).isErr()) schema = schema + 1;
    r = cur.next();
  }
  t.eqI32("table: 310 rows", rows, 310);
  t.ok("table: readRow answers what the per-column calls answer on every row", same);
  t.eqI32("table: the 300 records written before ALTER TABLE are short", schema, 300);

  t.ok("seekRowid 22, an overflow row", cur.seekRowid(toI64(22)).expect("seek"));
  const ints = new Array<i64>(6);
  const spans = new Array<i32>(18);
  t.ok("  selectRow every column", cur.selectRow(every).isOk());
  const read = cur.readRow(ints, spans, text);
  t.ok("  answers its text bytes, 3 + 6000 + 1", read.isOk() && read.value === 6004);
  t.eqI64("  the alias column is the rowid", ints[0], toI64(22));
  t.eqI64("  n", ints[1], toI64(22 * 3 - 400));
  t.eqI64("  r 11.0 is stored as an integer", ints[2], toI64(11));
  t.ok("  s is TEXT, its 3 bytes at 0", spans[9] === SQLITE_TEXT && spans[10] === 0 && spans[11] === 3);
  t.ok("  b is BLOB, its 6000 bytes after them", spans[12] === SQLITE_BLOB && spans[13] === 3 && spans[14] === 6000);
  t.ok("  z, 22 % 3 = 1, is 'z' at 6003", spans[15] === SQLITE_TEXT && spans[16] === 6003);
  const small = new Array<u8>(6003);
  for (let i = 0; i < 6; i++) ints[i] = toI64(-7);
  for (let i = 0; i < 18; i++) spans[i] = -7;
  const tight = cur.readRow(ints, spans, small);
  t.ok("  a text buffer one byte short answers the length needed", tight.isOk() && tight.value === 6004);
  t.ok("  and writes no ints or spans", allI64(ints, toI64(-7)) && allI32(spans, -7));
  t.ok("  though text holds the columns that fit, s22 first", small[0] === 115 && small[1] === 50 && small[2] === 50);
  t.ok("seekRowid 26, s '26'", cur.seekRowid(toI64(26)).expect("seek"));
  t.eqI64("  columnI64 converts it to 26", cur.columnI64(3), toI64(26));
  t.ok("  selectRow s", cur.selectRow([3]).isOk());
  const digits = cur.readRow(ints, spans, text);
  t.ok("  readRow answers its 2 bytes", digits.isOk() && digits.value === 2 && spans[0] === SQLITE_TEXT);
  t.eqI64("  and 0 for its integer, no conversion", ints[0], toI64(0));
  t.ok("seekRowid 34, s '7abc'", cur.seekRowid(toI64(34)).expect("seek"));
  t.eqI64("  columnI64 converts its leading digits to 7", cur.columnI64(3), toI64(7));
  const lead = cur.readRow(ints, spans, text);
  t.ok("  readRow answers its 4 bytes and 0", lead.isOk() && lead.value === 4 && ints[0] === toI64(0));
  t.ok("seekRowid 5", cur.seekRowid(toI64(5)).expect("seek"));
  for (let i = 0; i < 6; i++) ints[i] = toI64(-7);
  for (let i = 0; i < 18; i++) spans[i] = -7;
  t.ok("  selectRow late, 0, s", cur.selectRow(late).isOk());
  t.ok("  a short record is SCHEMA for the row", i32Err(cur.readRow(ints, spans, text), SQLITE_SCHEMA));
  t.ok("  and writes nothing", allI64(ints, toI64(-7)) && allI32(spans, -7));
  t.ok("  selectRow 1, 7 takes the list", cur.selectRow([1, 7]).isOk());
  t.ok("  and readRow is RANGE for column 7", i32Err(cur.readRow(ints, spans, text), SQLITE_RANGE));
  t.ok("  and leaves ints and spans as they were", allI64(ints, toI64(-7)) && allI32(spans, -7));
  t.ok("  selectRow -1, readRow is RANGE", cur.selectRow([-1]).isOk() && i32Err(cur.readRow(ints, spans, text), SQLITE_RANGE));
  t.ok("  selectRow 70000, readRow is RANGE", cur.selectRow([70000]).isOk() && i32Err(cur.readRow(ints, spans, text), SQLITE_RANGE));
  t.ok("  selectRow late, 0, s again", cur.selectRow(late).isOk());
  const wide = new Array<i32>(65536);
  t.ok("  selectRow of 65536 columns is MISUSE", voidErr(cur.selectRow(wide), SQLITE_MISUSE));
  t.ok("  and a refused list keeps the one chosen", i32Err(cur.readRow(ints, spans, text), SQLITE_SCHEMA));
  t.ok("  selectRow every column", cur.selectRow(every).isOk());
  t.ok("  ints shorter than the list is MISUSE", i32Err(cur.readRow([toI64(0)], spans, text), SQLITE_MISUSE));
  t.ok("  spans shorter than 3 per column is MISUSE", i32Err(cur.readRow(ints, [0, 0], text), SQLITE_MISUSE));
  t.ok("  and none of them writes", allI64(ints, toI64(-7)) && allI32(spans, -7));
  t.ok("  selectRow no columns", cur.selectRow(empty).isOk());
  const none = cur.readRow(ints, spans, text);
  t.ok("  no columns answers 0", none.isOk() && none.value === 0);
  t.ok("seekRowid 1000 is not there", !cur.seekRowid(toI64(1000)).expect("seek"));
  const gone = cur.readRow(ints, spans, text);
  t.ok("  and no row with no columns still answers 0", gone.isOk() && gone.value === 0);
  t.ok("  selectRow every column", cur.selectRow(every).isOk());
  t.ok("  even with columns chosen", i32Err(cur.readRow(ints, spans, text), SQLITE_MISUSE));

  const idx = db.openCursor("ts", "s DESC,rowid").expect("open ts");
  t.ok("readRow before any selectRow is MISUSE", i32Err(idx.readRow(ints, spans, text), SQLITE_MISUSE));
  const pair: i32[] = [1, 0];
  let entries = 0;
  let same2 = true;
  let m = idx.first();
  while (m.isOk() && m.value) {
    entries = entries + 1;
    if (!agrees(idx, pair, text, buf)) same2 = false;
    m = idx.next();
  }
  t.eqI32("index: 310 entries", entries, 310);
  t.ok("index: readRow answers what the per-column calls answer, the rowid among them", same2);
  t.ok("close the index cursor", idx.close().isOk());
  t.ok("  and readRow on it is MISUSE", i32Err(idx.readRow(ints, spans, text), SQLITE_MISUSE));
  t.ok("  and selectRow on it takes the list", idx.selectRow(pair).isOk());
  t.ok("  which readRow refuses with MISUSE", i32Err(idx.readRow(ints, spans, text), SQLITE_MISUSE));
  t.ok("close", cur.close().isOk());
  t.ok("endRead", db.endRead().isOk());
  t.ok("close the database", db.close().isOk());
  return t.done();
};

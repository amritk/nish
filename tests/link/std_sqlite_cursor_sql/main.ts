// A cursor reads what SQL reads. Each walk of a table or index, in both
// directions, and each seek, is checked row by row against the SELECT that
// answers the same question: rowid, a nullable text column, a signed integer
// column and a blob. Some index keys are 1502-byte texts, so the index entry
// itself spills onto overflow pages; some table records spill through a
// 5000-byte blob; a few names are NULL, which an index sorts first.
import { Suite } from "nish/testing";
import {
  OPEN_CREATE,
  OPEN_READWRITE,
  SEEK_GE,
  SEEK_GT,
  SEEK_LE,
  SEEK_LT,
  SQLITE_ERROR,
  SQLITE_NULL,
  Cursor,
  Database,
  Statement,
  openDatabase,
} from "nish/sqlite";

const WIDE: i32 = 6000;

/** Whether column `c` of the cursor and column `s` of the statement hold the same value. */
const sameText = (cur: Cursor, c: i32, q: Statement, s: i32, a: u8[], b: u8[]): boolean => {
  const ct = cur.columnType(c);
  if (ct.isErr()) return false;
  if (ct.value !== q.columnType(s)) return false;
  if (ct.value === SQLITE_NULL) return true;
  const n = cur.columnInto(c, a, 0);
  const m = q.columnInto(s, b, 0);
  if (n.isErr() || m.isErr() || n.value !== m.value || n.value > WIDE) return false;
  for (let i = 0; i < n.value; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

/**
 * Walks `cur` from `start` with `step` beside the rows of `sql`, comparing the
 * rowid, the text, the integer and (for the table) the blob. Answers the rows
 * matched, or -1 at the first difference.
 */
const walk = (
  db: Database,
  cur: Cursor,
  started: Result<boolean, i32>,
  forward: boolean,
  sql: string,
  table: boolean,
  a: u8[],
  b: u8[],
  limit: i32
): i32 => {
  const q = db.prepare(sql).expect(sql);
  let rows = 0;
  let moved = started;
  let same = true;
  while (same && rows < limit) {
    const s = q.step();
    if (s.isErr() || moved.isErr()) {
      same = false;
    } else if (!s.value || !moved.value) {
      same = s.value === moved.value;
      break;
    } else {
      const name = table ? 1 : 0;
      const score = table ? 2 : 1;
      same =
        cur.rowid() === q.columnI64(0) &&
        sameText(cur, name, q, 1, a, b) &&
        cur.columnI64(score) === q.columnI64(2) &&
        (!table || sameText(cur, 3, q, 3, a, b));
      rows = rows + 1;
      moved = forward ? cur.next() : cur.previous();
    }
  }
  q.finalize().expect("finalize");
  return same ? rows : -1;
};

const SCORES: readonly i32[] = [-51, -50, -7, 0, 13, 50, 51];
const OPS: readonly i32[] = [SEEK_GE, SEEK_GT, SEEK_LE, SEEK_LT];

/**
 * The SELECT whose first row is where `op` lands for `key` (and `score`, when
 * `two`). An index holds its NULL names below every text, so LE and LT walk
 * on into them, and GE and GT never reach them.
 */
const seekSql = (op: i32, key: string, score: i32, two: boolean): string => {
  const cols = "SELECT rowid, name, score FROM u WHERE ";
  const k = `'${key}'`;
  const up = " ORDER BY name, score DESC, rowid";
  const down = ") ORDER BY name IS NULL, name DESC, score, rowid DESC";
  if (!two) {
    if (op === SEEK_GE) return `${cols}name >= ${k}${up}`;
    if (op === SEEK_GT) return `${cols}name > ${k}${up}`;
    if (op === SEEK_LE) return `${cols}(name IS NULL OR name <= ${k}${down}`;
    return `${cols}(name IS NULL OR name < ${k}${down}`;
  }
  if (op === SEEK_GE) return `${cols}(name > ${k} OR (name = ${k} AND score <= ${score}))${up}`;
  if (op === SEEK_GT) return `${cols}(name > ${k} OR (name = ${k} AND score < ${score}))${up}`;
  if (op === SEEK_LE) return `${cols}(name IS NULL OR name < ${k} OR (name = ${k} AND score >= ${score})${down}`;
  return `${cols}(name IS NULL OR name < ${k} OR (name = ${k} AND score > ${score})${down}`;
};

export const main = (): i32 => {
  const t = new Suite("std_sqlite_cursor_sql");
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE).expect("open");
  const schema =
    "CREATE TABLE u (id INTEGER PRIMARY KEY, name TEXT, score INT, pad BLOB);" +
    "CREATE INDEX u_ns ON u (name, score DESC);" +
    "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 600)" +
    " INSERT INTO u SELECT x * 3 - 1000," +
    " CASE WHEN x % 50 = 0 THEN NULL" +
    " WHEN x % 11 = 0 THEN 'L' || (x % 3) || replace(hex(zeroblob(1500)), '00', 'q')" +
    " ELSE 'k' || (x % 17) END," +
    " (x * 37) % 101 - 50," +
    " CAST(replace(hex(zeroblob(CASE WHEN x % 13 = 0 THEN 5000 ELSE x % 5 END)), '00'," +
    " char(65 + x % 26)) AS BLOB) FROM c";
  if (db.exec(schema).isErr()) {
    t.fail("exec", db.error(SQLITE_ERROR).message);
    return t.done();
  }
  const a = new Array<u8>(WIDE);
  const b = new Array<u8>(WIDE);
  t.ok("beginRead", db.beginRead().isOk());
  const u = db.openCursor("u", "id,name,score,pad").expect("open u");
  const all = "SELECT rowid, name, score, pad FROM u ORDER BY rowid";
  t.eqI32("the table, first to last", walk(db, u, u.first(), true, all, true, a, b, 1000), 600);
  t.eqI32(
    "the table, last to first",
    walk(db, u, u.last(), false, "SELECT rowid, name, score, pad FROM u ORDER BY rowid DESC", true, a, b, 1000),
    600
  );
  let rowids = true;
  for (let r = -1000; r <= 820; r += 7) {
    const at = u.seekRowid(toI64(r));
    const hit = (r + 1000) % 3 === 0 && r <= 800 && r >= -997;
    if (at.isErr() || at.value !== hit) rowids = false;
    if (hit && walk(db, u, at, true, `SELECT rowid, name, score, pad FROM u WHERE rowid >= ${r} ORDER BY rowid`, true, a, b, 3) !== 3) {
      rowids = false;
    }
  }
  t.ok("seekRowid finds a rowid where WHERE rowid = r does, and walks on as SQL does", rowids);

  const ix = db.openCursor("u_ns", "name,score DESC,rowid").expect("open u_ns");
  const ordered = "SELECT rowid, name, score FROM u ORDER BY name, score DESC, rowid";
  t.eqI32("the index, first to last", walk(db, ix, ix.first(), true, ordered, false, a, b, 1000), 600);
  t.eqI32(
    "the index, last to first",
    walk(db, ix, ix.last(), false, "SELECT rowid, name, score FROM u ORDER BY name DESC, score, rowid DESC", false, a, b, 1000),
    600
  );

  const KEYS: string[] = ["k0", "k10", "k16", "k5", "k9", "L1", "L2q", "", "a", "zz"];
  const OP_NAMES: string[] = ["GE", "GT", "LE", "LT"];
  const qs = new Array<u8>(3002);
  qs[0] = 76;
  qs[1] = 50;
  for (let i = 2; i < 3002; i++) qs[i] = 113;
  const long = String.fromBytes(qs, 0, 3002);
  let seeks = 0;
  let wrong = "";
  for (let k = 0; k <= KEYS.length; k++) {
    const key = k < KEYS.length ? KEYS[k] : long;
    for (let o = 0; o < OPS.length; o++) {
      ix.keyReset().expect("keyReset");
      ix.keyText(key).expect("keyText");
      const one = walk(db, ix, ix.seek(OPS[o]), OPS[o] <= SEEK_GT, seekSql(OPS[o], key, 0, false), false, a, b, 4);
      if (one < 0) wrong = `${wrong} ${OP_NAMES[o]}(${key.length > 8 ? "long" : key})`;
      seeks = seeks + 1;
      for (let s = 0; s < SCORES.length; s++) {
        ix.keyReset().expect("keyReset");
        ix.keyText(key).expect("keyText");
        ix.keyI64(toI64(SCORES[s])).expect("keyI64");
        const sql = seekSql(OPS[o], key, SCORES[s], true);
        if (walk(db, ix, ix.seek(OPS[o]), OPS[o] <= SEEK_GT, sql, false, a, b, 4) < 0) {
          wrong = `${wrong} ${OP_NAMES[o]}(${key.length > 8 ? "long" : key},${SCORES[s]})`;
        }
        seeks = seeks + 1;
      }
    }
  }
  t.eqStr("every seek lands on the row SQL's ORDER BY puts first", wrong, "");
  t.eqI32("  seeks compared", seeks, 11 * 4 * 8);
  t.ok("close", u.close().isOk() && ix.close().isOk());
  t.ok("endRead", db.endRead().isOk());
  t.ok("close the connection", db.close().isOk());
  return t.done();
};

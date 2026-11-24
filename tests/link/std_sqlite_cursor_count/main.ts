// Cursor.countRange against SQL: for every key k in a range, the count it
// writes is `SELECT count(*) ... WHERE col = k`, on an ascending index, a DESC
// one, a two-column one and a NUMERIC column's, across keys with no entries,
// the first and last key, a span running past the last key, and the ends of
// the i64 range, where hi - lo does not fit an i64. The column also holds
// NULLs, a REAL and a TEXT value, which equal no integer. Each refusal is
// pinned with `out` left as it was: a table cursor (MISUSE), an index whose
// first column is TEXT (MISMATCH), lo > hi and a span longer than `out`
// (RANGE). Last, a seek and count loop run after a first pass allocates
// nothing SQLite's counters see; they count only when SQLite is built with
// SQLITE_DEFAULT_MEMSTATUS=1, which tests/run.js does for this program and
// checks the last line flips.
import { Suite } from "nish/testing";
import {
  OPEN_CREATE,
  OPEN_READWRITE,
  SEEK_GE,
  SQLITE_ERROR,
  SQLITE_MISMATCH,
  SQLITE_MISUSE,
  SQLITE_RANGE,
  Cursor,
  Database,
  openDatabase,
} from "nish/sqlite";

declare function sqlite3_memory_used(): i64;
declare function sqlite3_memory_highwater(reset: i32): i64;

/** The smallest i64, -2^63. */
const MIN: i64 = -4294967296 * 2147483648;
/** The largest i64, 2^63 - 1. */
const MAX: i64 = -(MIN + 1);

/** `SELECT count(*) FROM tbl WHERE col = k`. */
const sqlCount = (db: Database, tbl: string, col: string, k: i64): i64 => {
  const q = db.prepare(`SELECT count(*) FROM ${tbl} WHERE ${col} = ?1`).expect("prepare the count");
  q.bindI64(1, k).expect("bind");
  q.step().expect("step");
  const n = q.columnI64(0);
  q.finalize().expect("finalize");
  return n;
};

/** Counts lo..hi on `cur`, and checks each against SQL and the total against their sum. */
const pin = (t: Suite, db: Database, cur: Cursor, what: string, tbl: string, col: string, lo: i64, hi: i64): void => {
  const span = toI32(hi - lo) + 1;
  const out = new Array<i64>(span + 2);
  for (let i: i32 = 0; i < out.length; i++) out[i] = toI64(-7);
  const r = cur.countRange(lo, hi, out);
  if (r.isErr()) {
    t.fail(`${what}: countRange(${lo}, ${hi})`, `refused with ${r.error}`);
    return;
  }
  let sum = toI64(0);
  let same = true;
  const misses: string[] = [];
  for (let i = 0; i < span && i < out.length; i++) {
    const k = lo + toI64(i);
    const got = out[i];
    const want = sqlCount(db, tbl, col, k);
    sum = sum + want;
    if (got !== want) {
      same = false;
      misses.push(`k=${k}: ${got} want ${want}`);
    }
  }
  if (same) t.pass(`${what}: countRange(${lo}, ${hi}) is count(*) for every k`);
  else t.fail(`${what}: countRange(${lo}, ${hi}) is count(*) for every k`, misses.join("; "));
  t.ok(`${what}: countRange(${lo}, ${hi}) answers the sum`, toI64(r.value) === sum);
  t.ok(`${what}: countRange(${lo}, ${hi}) leaves out past the span`, out[span] === toI64(-7) && out[span + 1] === toI64(-7));
};

/** `cur.countRange(lo, hi, out)` refuses with `code` and leaves `out` as it was. */
const refuses = (t: Suite, cur: Cursor, what: string, lo: i64, hi: i64, len: i32, code: i32): void => {
  const out = new Array<i64>(len);
  for (let i = 0; i < out.length; i++) out[i] = toI64(-7);
  const r = cur.countRange(lo, hi, out);
  let kept = true;
  for (let i = 0; i < out.length; i++) if (out[i] !== toI64(-7)) kept = false;
  t.ok(`refused: ${what}`, r.isErr() && r.error === code);
  t.ok(`refused: ${what}, out untouched`, kept);
};

export const main = (): i32 => {
  const t = new Suite("std_sqlite_cursor_count");
  const opened = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE);
  if (opened.isErr()) {
    t.fail("open", opened.error.message);
    return t.done();
  }
  const db = opened.value;
  // a = x % 13 skips 4 and 9; keys 0 and 12 are the first and last small
  // ones. Then NULLs, a REAL between 2 and 3, a TEXT, and the two i64 ends.
  const setup =
    "CREATE TABLE t (a INTEGER, b TEXT);" +
    "CREATE INDEX t_a ON t (a);" +
    "CREATE INDEX t_a_desc ON t (a DESC);" +
    "CREATE INDEX t_ab ON t (a, b);" +
    "CREATE TABLE n (x NUMERIC);" +
    "CREATE INDEX n_x ON n (x);" +
    "CREATE TABLE s (x TEXT);" +
    "CREATE INDEX s_x ON s (x);" +
    "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 400)" +
    " INSERT INTO t SELECT x % 13, 'b' || x FROM c WHERE x % 13 NOT IN (4, 9);" +
    "INSERT INTO t VALUES (NULL, 'null1'), (NULL, 'null2'), (2.5, 'real'), ('zz', 'text')," +
    " (9223372036854775807, 'max'), (9223372036854775807, 'max2'), (-9223372036854775808, 'min');" +
    "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 60)" +
    " INSERT INTO n SELECT CASE x % 4 WHEN 0 THEN (x % 7) || '.0' WHEN 1 THEN x % 7 WHEN 2 THEN (x % 7) + 0.5 ELSE '0' || (x % 7) END FROM c;" +
    "INSERT INTO s VALUES ('1'), ('2'), ('2');";
  if (db.exec(setup).isErr()) {
    t.fail("setup", db.error(SQLITE_ERROR).message);
    return t.done();
  }
  db.beginRead().expect("beginRead");
  const asc = db.openCursor("t_a", "a,rowid").expect("open t_a");
  const desc = db.openCursor("t_a_desc", "a DESC,rowid").expect("open t_a_desc");
  const ab = db.openCursor("t_ab", "a,b,rowid").expect("open t_ab");
  const num = db.openCursor("n_x", "x,rowid").expect("open n_x");
  const txt = db.openCursor("s_x", "x,rowid").expect("open s_x");
  const tbl = db.openCursor("t", "a,b").expect("open t");

  pin(t, db, asc, "asc", "t", "a", toI64(-2), toI64(14));
  pin(t, db, asc, "asc", "t", "a", toI64(0), toI64(0));
  pin(t, db, asc, "asc", "t", "a", toI64(12), toI64(12));
  pin(t, db, asc, "asc", "t", "a", toI64(4), toI64(4));
  pin(t, db, asc, "asc", "t", "a", toI64(10), toI64(40));
  pin(t, db, asc, "asc", "t", "a", MAX - toI64(3), MAX);
  pin(t, db, asc, "asc", "t", "a", MIN, MIN + toI64(3));
  pin(t, db, desc, "desc", "t", "a", toI64(-2), toI64(14));
  pin(t, db, desc, "desc", "t", "a", toI64(12), toI64(12));
  pin(t, db, desc, "desc", "t", "a", toI64(0), toI64(0));
  pin(t, db, desc, "desc", "t", "a", toI64(10), toI64(40));
  pin(t, db, desc, "desc", "t", "a", MAX - toI64(3), MAX);
  pin(t, db, desc, "desc", "t", "a", MIN, MIN + toI64(3));
  pin(t, db, ab, "two columns", "t", "a", toI64(-2), toI64(14));
  pin(t, db, num, "numeric", "n", "x", toI64(-1), toI64(8));

  refuses(t, tbl, "a table cursor is SQLITE_MISUSE", toI64(0), toI64(3), 4, SQLITE_MISUSE);
  refuses(t, txt, "a TEXT first column is SQLITE_MISMATCH", toI64(0), toI64(3), 4, SQLITE_MISMATCH);
  refuses(t, asc, "lo > hi is SQLITE_RANGE", toI64(3), toI64(2), 4, SQLITE_RANGE);
  refuses(t, asc, "a span longer than out is SQLITE_RANGE", toI64(0), toI64(4), 4, SQLITE_RANGE);
  refuses(t, asc, "MIN..MAX is SQLITE_RANGE", MIN, MAX, 4, SQLITE_RANGE);
  refuses(t, asc, "an empty out is SQLITE_RANGE", toI64(0), toI64(0), 0, SQLITE_RANGE);

  // A count leaves the cursor on no row and its key cleared: a seek with no
  // key part set is refused, as on a fresh cursor, and the cursor has no row.
  asc.keyReset().expect("keyReset");
  asc.keyI64(toI64(7)).expect("keyI64");
  asc.countRange(toI64(0), toI64(1), new Array<i64>(2)).expect("count");
  const after = asc.seek(SEEK_GE);
  t.ok("after a count, a seek with no key part is SQLITE_MISUSE", after.isErr() && after.error === SQLITE_MISUSE);
  t.ok("and the cursor is on no row", asc.rowid() === toI64(0));
  asc.keyReset().expect("keyReset");
  asc.keyI64(toI64(5)).expect("keyI64");
  const five = asc.seek(SEEK_GE);
  t.ok("an integer seek after a count lands on its key", five.isOk() && five.value && asc.columnI64(0) === toI64(5));

  // A steady loop of seeks and counts after a first pass allocates nothing.
  const out = new Array<i64>(16);
  let passes = 0;
  let used = toI64(0);
  let peak = toI64(0);
  let end = toI64(0);
  for (let pass: i32 = 0; pass < 3; pass++) {
    if (pass === 1) {
      used = sqlite3_memory_used();
      sqlite3_memory_highwater(1);
    }
    for (let k: i32 = 0; k < 13; k++) {
      asc.keyReset().expect("keyReset");
      asc.keyI64(toI64(k)).expect("keyI64");
      asc.seek(SEEK_GE).expect("seek");
      desc.countRange(toI64(k), toI64(k + 2), out).expect("count desc");
      asc.countRange(toI64(0), toI64(15), out).expect("count asc");
    }
    passes = passes + 1;
  }
  peak = sqlite3_memory_highwater(0);
  end = sqlite3_memory_used();
  t.eqI32("the loop ran", passes, 3);
  t.ok("the steady loop allocates nothing", peak === used && end === used);

  asc.close().expect("close asc");
  desc.close().expect("close desc");
  ab.close().expect("close ab");
  num.close().expect("close num");
  txt.close().expect("close txt");
  tbl.close().expect("close tbl");
  db.endRead().expect("endRead");
  t.ok("close", db.close().isOk());
  console.log(`memory counted: ${used > toI64(0)}`);
  return t.done();
};
